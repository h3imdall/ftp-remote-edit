'use babel';

import { getValueAtKeyPath, hasKeyPath } from 'key-path-helpers';

const Path = require('path');
const FileSystem = require('fs-plus');
const CSON = require('season');
const Minimatch = require('minimatch').Minimatch;

let ignoredPatterns = null;
let ignoredFinderPatterns = null;

export const getFullExtension = (filePath) => {
  let fullExtension = '';
  let extension = '';
  while (extension = Path.extname(filePath)) {
    fullExtension = extension + fullExtension
    filePath = Path.basename(filePath, extension)
  }
  return fullExtension;
}

export const createLocalPath = (localpath) => {
  try {
    let arrPath = localpath.split(Path.sep);
    arrPath.pop();

    arrPath.reduce((tmpPath, dir) => {
      tmpPath += Path.sep + dir;
      if (!FileSystem.existsSync(tmpPath)) {
        FileSystem.mkdirSync(tmpPath);
      }
      return tmpPath;
    });
  } catch (err) { return err; }
}

export const deleteLocalPath = (localpath) => {
  try {
    if (FileSystem.existsSync(localpath)) {
      FileSystem.readdirSync(localpath).forEach((file, index) => {
        let curPath = localpath + "/" + file;
        if (FileSystem.lstatSync(curPath).isDirectory()) { // recurse
          return deleteLocalPath(curPath);
        } else { // delete file
          FileSystem.unlinkSync(curPath);
        }
      });
      FileSystem.rmdirSync(localpath);
    }
  } catch (err) { return err; }
}

export const resetIgnoredPatterns = () => {
  ignoredPatterns = null;
}

export const loadIgnoredPatterns = () => {
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
}

export const isPathIgnored = (filePath) => {
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

export const resetIgnoredFinderPatterns = () => {
  ignoredFinderPatterns = null;
}

export const loadIgnoredFinderPatterns = () => {
  let ignoredName, ignoredNames, ignoredCoreNames, ignoredFinderNames, i, len, results;

  if (ignoredFinderPatterns) return ignoredFinderPatterns;
  if (ignoredFinderPatterns == null) ignoredFinderPatterns = [];

  if (atom.config.get('ftp-remote-edit.tree.hideIgnoredNames')) {
    ignoredCoreNames = (atom.config.get('core.ignoredNames')) != null ? atom.config.get('core.ignoredNames') : [];
    if (typeof ignoredCoreNames === 'string') {
      ignoredCoreNames = [ignoredCoreNames];
    }
  } else {
    ignoredCoreNames = [];
  }

  ignoredFinderNames = (atom.config.get('ftp-remote-edit.finder.ignoredNames')) != null ? atom.config.get('ftp-remote-edit.finder.ignoredNames') : [];
  if (typeof ignoredFinderNames === 'string') {
    ignoredFinderNames = [ignoredFinderNames];
  }

  ignoredNames = [];
  ignoredNames = ignoredCoreNames.concat(ignoredFinderNames);

  results = [];
  for (i = 0, len = ignoredNames.length; i < len; i++) {
    ignoredName = ignoredNames[i];
    if (ignoredName) {
      try {
        ignoredFinderPatterns.push(new Minimatch(ignoredName, {
          matchBase: true,
          dot: true
        }));
      } catch (err) {
        console.log(err, "Ftp-Remote-Edit: Error parsing ignore pattern (" + ignoredName + ")");
      }
    }
  }
  return ignoredFinderPatterns;
}

export const isFinderPathIgnored = (filePath) => {
  let ignoredPatterns = loadIgnoredFinderPatterns();
  for (i = 0, len = ignoredPatterns.length; i < len; i++) {
    if (ignoredPatterns[i].match(filePath)) {
      return true;
    }
  }

  return false;
}

export const getTextEditor = (pathOnFileSystem, activate = false) => {
  let foundEditor = null;
  let texteditors = atom.workspace.getTextEditors();
  texteditors.forEach((texteditor) => {
    if (texteditor.getPath() == pathOnFileSystem) {
      foundEditor = texteditor;
      return false;
    }
  });

  if (activate && foundEditor) {
    pane = atom.workspace.paneForItem(foundEditor);
    if (pane) pane.activateItem(foundEditor);
  }

  return foundEditor;
}
