'use babel';

import { getValueAtKeyPath, hasKeyPath } from 'key-path-helpers';

const Path = require('path');
const FileSystem = require('fs-plus');
const CSON = require('season');

export const getFullExtension = function (filePath) {
  let fullExtension = '';
  let extension = '';
  while (extension = Path.extname(filePath)) {
    fullExtension = extension + fullExtension
    filePath = Path.basename(filePath, extension)
  }
  return fullExtension;
};

export const createLocalPath = function (localpath) {
  let arrPath = localpath.split(Path.sep);
  arrPath.pop();

  arrPath.reduce((tmpPath, dir) => {
    tmpPath += Path.sep + dir;
    if (!FileSystem.existsSync(tmpPath)) {
      FileSystem.mkdirSync(tmpPath);
    }
    return tmpPath;
  });
};

// Uncaught SyntaxError: Unexpected token  in JSON at position 0 #44
// https://github.com/h3imdall/ftp-remote-edit/issues/44
export const getConfig = function (keyPath) {
  let configFilePath = atom.config.getUserConfigPath();
  let userConfig = {};
  let value = null;
  let value_atom = null;
  let value_file = null;

  value = atom.config.get(keyPath);
  value_atom = atom.config.get(keyPath);

  if (fs.existsSync(configFilePath)) {
    try {
      userConfig = CSON.readFileSync(configFilePath);
      if (hasKeyPath(userConfig, '*.' + keyPath)) {
        value_file = getValueAtKeyPath(userConfig, '*.' + keyPath);
      } else {
        value_file = undefined;
      }

      if (value == value_atom && value == value_file) {
        return value;
      }

      return value_file;

    } catch (e) {
      value_file = undefined;
    }
  }

  return value;
}
