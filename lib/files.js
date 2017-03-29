var fs = require('fs');
var path = require('path');

module.exports = {
  getCurrentDirectoryBase: () => path.basename(process.cwd()),

  directoryExists: (filePath) => {
    try {
      return fs.statSync(filePath).isDirectory();
    } catch (err) {
      return false;
    }
  },

};
