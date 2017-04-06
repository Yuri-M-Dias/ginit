var fs = require('fs');
var path = require('path');

const directoryExists = (filePath) => {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch (err) {
    console.error(['files', err]);
    return false;
  }
};

const getCurrentDirectoryPath = () => path.basename(process.cwd());

module.exports = {
  getCurrentDirectoryBase: getCurrentDirectoryPath,
  directoryExists: directoryExists,
  hasGitDirectory: () => directoryExists('.git'),
};
