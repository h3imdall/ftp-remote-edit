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
