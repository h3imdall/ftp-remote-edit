'use babel';

import { getValueAtKeyPath, hasKeyPath } from 'key-path-helpers';

const Path = require('path');
const FileSystem = require('fs-plus');
const CSON = require('season');
const Minimatch = require('minimatch').Minimatch;
let ignoredPatterns = null;

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

  try {
    if (FileSystem.existsSync(configFilePath)) {
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
    }
  } catch (e) {
    value_file = undefined;
  }

  return value;
};

export const resetIgnoredPatterns = function () {
  ignoredPatterns = null;
};

export const loadIgnoredPatterns = function () {
  let ignoredName, ignoredNames, i, len, results;

  if (!atom.config.get('ftp-remote-edit.tree.hideIgnoredNames')) {
    return;
  }

  if (ignoredPatterns) return ignoredPatterns;
  if (ignoredPatterns == null) ignoredPatterns = [];

  ignoredNames = (atom.config.get('core.ignoredNames')) != null ? atom.config.get('core.ignoredNames') : [];
  if (typeof ignoredNames === 'string') {
    ignoredNames = [ignoredNames];
  }
  results = [];
  for (i = 0, len = ignoredNames.length; i < len; i++) {
    ignoredName = ignoredNames[i];
    if (ignoredName) {
      try {
        ignoredPatterns.push(new Minimatch(ignoredName, {
          matchBase: true,
          dot: true
        }));
      } catch (err) {
        console.log(err, "Ftp-Remote-Edit: Error parsing ignore pattern (" + ignoredName + ")");
      }
    }
  }
  return ignoredPatterns;
};

export const isPathIgnored = function (filePath) {
  if (atom.config.get('ftp-remote-edit.tree.hideIgnoredNames')) {
    let ignoredPatterns = loadIgnoredPatterns();
    for (i = 0, len = ignoredPatterns.length; i < len; i++) {
      if (ignoredPatterns[i].match(filePath)) {
        return true;
      }
    }
  }
  return false;
}
