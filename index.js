#!/usr/bin/env node

'use strict';

// Terrible, terrible code.

var chalk       = require('chalk');
var clear       = require('clear');
var CLI         = require('clui');
var figlet      = require('figlet');
var inquirer    = require('inquirer');
var Preferences = require('preferences');
var Spinner     = CLI.Spinner;
var GitHubApi   = require('github');
var _           = require('lodash');
var git         = require('simple-git')();
var touch       = require('touch');
var fs          = require('fs');

var github = new GitHubApi({
  version: '3.0.0',
});

const rocketArt = `
      |
     / \\
    / _ \\
   |.o '.|
   |'._.'|
   |     |
 ,'|  |  |\`.
/  |  |  |  \\
|,-'--|--'-.|
`;
const printGinitMessage = () => {
  const message = 'Ginit - Yuri-M-Dias';
  const chalkedMessage = chalk.green(
    figlet.textSync(
      message, { horizontalLayout: 'full' }
    )
  );
  return chalkedMessage;
};

console.log(printGinitMessage());
//console.log(chalk.blue(rocketArt));

var files       = require('./lib/files');

if (files.hasGitDirectory()) {
  console.log(chalk.red('Already a git repository!'));
  process.exit();
}

const getGithubCredentials = () => {
  const questions = [
    {
      name: 'username',
      type: 'input',
      message: 'Enter your Github username or e-mail address:',
      validate: (value) => {
        if (value.length) {
          return true;
        } else {
          return 'Please enter your username or e-mail address';
        }
      },
    },
    {
      name: 'password',
      type: 'password',
      message: 'Enter your password:',
      validate: (value) => {
        if (value.length) {
          return true;
        } else {
          return 'Please enter your password';
        }
      },
    },
  ];

  return inquirer.prompt(questions);
};

const getGithubToken = () => {
  var prefs = new Preferences('ginit');

  if (prefs.github && prefs.github.token) {
    return Promise.resolve(prefs.github.token);
  }

  getGithubCredentials((credentials) => {
    var status = new Spinner('Authenticating you, please wait...');
    status.start();

    github.authenticate(
      _.extend(
        {
          type: 'basic',
        },
        credentials
      )
    );

    github.authorization.create({
      scopes: ['user', 'public_repo', 'repo', 'repo:status'],
      note: 'ginit, the command-line tool for initalizing Git repos',
    }, (err, res) => {
      status.stop();
      console.log([err, res]);
      if (err) {
        return Promise.reject(err);
      }

      let token = res.data.token;
      if (token) {
        prefs.github = {
          token: token,
        };
        return Promise.resolve(prefs.github.token);
      }

      return Promise.reject(new Error('Invalid GitHub credentials'));
    });

  });

};

const createRepo = (callback) => {
  var argv = require('minimist')(process.argv.slice(2));

  var questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Enter a name for the repository:',
      default: argv._[0] || files.getCurrentDirectoryBase(),
      validate: (value) => {
        if (value.length) {
          return true;
        } else {
          return 'Please enter a name for the repository';
        }
      },
    },
    {
      type: 'input',
      name: 'description',
      default: argv._[1] || null,
      message: 'Optionally enter a description of the repository:',
    },
    {
      type: 'list',
      name: 'visibility',
      message: 'Public or private:',
      choices: ['public', 'private'],
      default: 'public',
    },
  ];

  inquirer.prompt(questions).then((answers) => {
    var status = new Spinner('Creating repository...');
    status.start();

    var data = {
      name: answers.name,
      description: answers.description,
      private: (answers.visibility === 'private'),
    };

    github.repos.create(
      data,
      (err, res) => {
        status.stop();
        if (err) {
          return callback(err);
        }

        return callback(null, res.ssh_url);
      }
    );
  });
};

const createGitignore = (callback) => {
  console.log(['create']);
  var filelist = _.without(fs.readdirSync('.'), '.git', '.gitignore');

  if (filelist.length) {
    inquirer.prompt(
      [
        {
          type: 'checkbox',
          name: 'ignore',
          message: 'Select the files and/or folders you wish to ignore:',
          choices: filelist,
          default: ['node_modules', 'bower_components'],
        },
      ]
    ).then((answers) => {
      if (answers.ignore.length) {
        fs.writeFileSync('.gitignore', answers.ignore.join('\n'));
      } else {
        touch('.gitignore');
      }

      return callback();
    });
  } else {
    touch('.gitignore');
    return callback();
  }
};

const setupRepo = (url, callback) => {
  var status = new Spinner('Setting up the repository...');
  status.start();

  const initialMessage = ':rocket: science! Initial commit.';

  git
    .init()
    .add('.gitignore')
    .add('./*')
    .commit(initialMessage)
    .addRemote('origin', url)
    .push('origin', 'master')
    .then(() => {
      status.stop();
      return callback();
    });
};

const githubAuth = (callback) => {
  getGithubToken((err, token) => {
    if (err) {
      return callback(err);
    }

    github.authenticate({
      type: 'oauth',
      token: token,
    });
    return callback(null, token);
  });
};

githubAuth((err, authed) => {
  if (err) {
    switch (err.code) {
      case 401:
        console.log(chalk.red('Couldn\'t log you in. Please try again.'));
        break;
      case 422:
        console.log(chalk.red('You already have an access token.'));
        break;
    }
  }

  if (authed) {
    console.log(chalk.green('Sucessfully authenticated!'));
    createRepo((err, url) => {
      if (err) {
        console.log(['An error has occured', err]);
      }

      if (url) {
        createGitignore(() => {
          setupRepo(url, (err) => {
            if (!err) {
              console.log(chalk.green('All done!'));
            } else {
              console.log(err);
            }
          });
        });
      }
    });
  }

});
