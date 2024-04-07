'use babel';

const atom = global.atom;
const Path = require('path');
const FileSystem = require('fs-plus');
const Minimatch = require('minimatch').Minimatch;

let ignoredPatterns = null;
let ignoredFinderPatterns = null;

export const logDebug = (param1, param2) => {
  if (atom.config.get('ftp-remote-edit.dev.debug')) {
    if (param1 && param2) {
      console.log(param1, param2);
    } else if (param1) {
      console.log(param1);
    }
  }
}

export const showMessage = (msg, type = 'info') => {
  if (msg instanceof Error) {
    msg = msg.message;
  }

  if (typeof msg !== 'string') {
    msg = 'Unknown error';
  }

  if (type === 'success') {
    atom.notifications.addSuccess('Ftp-Remote-Edit', {
      description: msg
    });
  } else if (type === 'info') {
    atom.notifications.addInfo('Ftp-Remote-Edit', {
      description: msg
    });
  } else if (type === 'warning') {
    atom.notifications.addWarning('Ftp-Remote-Edit', {
      description: msg
    });
  } else {
    atom.notifications.addError('Ftp-Remote-Edit', {
      description: msg,
    });
  }
}

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

export const moveLocalPath = (srclocalpath, targetlocalpath) => {
  try {
    let tmp = targetlocalpath.split(Path.sep);
    tmp.pop();
    let parentPath = tmp.join(Path.sep);

    if (!FileSystem.existsSync(parentPath)) {
      FileSystem.makeTreeSync(parentPath);
    }
    if (FileSystem.existsSync(targetlocalpath)) {
      FileSystem.removeSync(targetlocalpath);
    }
    FileSystem.moveSync(srclocalpath, targetlocalpath);
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
  for (let i = 0, len = ignoredNames.length; i < len; i++) {
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
    for (let i = 0, len = ignoredPatterns.length; i < len; i++) {
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
  for (let i = 0, len = ignoredNames.length; i < len; i++) {
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
  for (let i = 0, len = ignoredPatterns.length; i < len; i++) {
    if (ignoredPatterns[i].match(filePath)) {
      return true;
    }
  }

  return false;
}

export const highlight = (path, matches, offsetIndex) => {
  let lastIndex = 0;
  let matchedChars = [];
  const fragment = document.createDocumentFragment();
  for (let matchIndex of matches) {
    matchIndex -= offsetIndex;
    // If marking up the basename, omit path matches
    if (matchIndex < 0) {
      continue;
    }
    const unmatched = path.substring(lastIndex, matchIndex);
    if (unmatched) {
      if (matchedChars.length > 0) {
        const span = document.createElement('span');
        span.classList.add('character-match');
        span.textContent = matchedChars.join('');
        fragment.appendChild(span);
        matchedChars = [];
      }

      fragment.appendChild(document.createTextNode(unmatched))
    }

    matchedChars.push(path[matchIndex]);
    lastIndex = matchIndex + 1;
  }

  if (matchedChars.length > 0) {
    const span = document.createElement('span');
    span.classList.add('character-match');
    span.textContent = matchedChars.join('');
    fragment.appendChild(span);
  }

  // Remaining characters are plain text
  fragment.appendChild(document.createTextNode(path.substring(lastIndex)));
  return fragment;
}

export const rightsToPermissions = (rights) => {
  const self = this;

  if (!rights) return;

  let user = rights.user.split('');
  let group = rights.group.split('');
  let other = rights.other.split('');

  let permissionsuser = 0;
  let permissionsgroup = 0;
  let permissionsother = 0;

  user.forEach((right) => {
    if (right == 'r') permissionsuser += 4;
    if (right == 'w') permissionsuser += 2;
    if (right == 'x') permissionsuser += 1;
  });

  group.forEach((right) => {
    if (right == 'r') permissionsgroup += 4;
    if (right == 'w') permissionsgroup += 2;
    if (right == 'x') permissionsgroup += 1;
  });

  other.forEach((right) => {
    if (right == 'r') permissionsother += 4;
    if (right == 'w') permissionsother += 2;
    if (right == 'x') permissionsother += 1;
  });

  return permissionsuser.toString() + permissionsgroup.toString() + permissionsother.toString();
}

export const permissionsToRights = (permissions) => {
  const self = this;

  let groups = permissions.split('');

  let rights = {
    user: "",
    group: "",
    other: "",
  }

  if (groups[0] == 7) {
    rights.user += 'rwx';
  } else if (groups[0] == 6) {
    rights.user = 'rw';
  } else if (groups[0] == 5) {
    rights.user = 'rx';
  } else if (groups[0] == 4) {
    rights.user = 'r';
  } else if (groups[0] == 3) {
    rights.user = 'wx';
  } else if (groups[0] == 2) {
    rights.user = 'w';
  } else if (groups[0] == 1) {
    rights.user = 'x';
  } else if (groups[0] == 'x') {
    rights.user = self.rights.user;
  } else {
    rights.user = '';
  }

  if (groups[1] == 7) {
    rights.group += 'rwx';
  } else if (groups[1] == 6) {
    rights.group = 'rw';
  } else if (groups[1] == 5) {
    rights.group = 'rx';
  } else if (groups[1] == 4) {
    rights.group = 'r';
  } else if (groups[1] == 3) {
    rights.group = 'wx';
  } else if (groups[1] == 2) {
    rights.group = 'w';
  } else if (groups[1] == 1) {
    rights.group = 'x';
  } else if (groups[1] == 'x') {
    rights.group = self.rights.group;
  } else {
    rights.group = '';
  }

  if (groups[2] == 7) {
    rights.other += 'rwx';
  } else if (groups[2] == 6) {
    rights.other = 'rw';
  } else if (groups[2] == 5) {
    rights.other = 'rx';
  } else if (groups[2] == 4) {
    rights.other = 'r';
  } else if (groups[2] == 3) {
    rights.other = 'wx';
  } else if (groups[2] == 2) {
    rights.other = 'w';
  } else if (groups[2] == 1) {
    rights.other = 'x';
  } else if (groups[2] == 'x') {
    rights.other = self.rights.other;
  } else {
    rights.other = '';
  }

  return rights;
}

export const parseFTPDate = (line) => {
  const RE_LINE = new RegExp("^(\\w{3})\\s+(\\d{1,2})\\s+((\\d{1,2}):(\\d{1,2}))*(\\d{4})*$");
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const groups = line.trim().match(RE_LINE)

  try {
    if (groups) {
      let month = parseInt(MONTHS[groups[1].toLowerCase()], 10);
      let day = parseInt(groups[2], 10)
      let year = (groups[6]) ? parseInt(groups[6], 10) : (new Date()).getFullYear();
      let hour = (groups[4]) ? parseInt(groups[4], 10) : null;
      let mins = (groups[5]) ? parseInt(groups[5], 10) : null;

      if (month < 10) month = `0${month}`;
      if (day < 10) day = `0${day}`;
      if (hour && hour < 10) hour = `0${hour}`;
      if (mins && mins < 10) mins = `0${mins}`;

      if (hour) {
        return new Date(`${year}-${month}-${day}T${hour}:${mins}`);
      } else {
        return new Date(`${year}-${month}-${day}`);
      }
    }
  } catch (error) {
    return undefined;
  }
  return undefined;
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
    let pane = atom.workspace.paneForItem(foundEditor);
    if (pane) pane.activateItem(foundEditor);
  }

  return foundEditor;
}

export const forEachAsync = (array, callback) => {
  return array.reduce((promise, item) => {
    return promise.then((result) => {
      return callback(item);
    });
  }, Promise.resolve());
}

// Return 1  if versionA > versionB
// Return 0  if versionA == versionB
// Return -1 if versionA < versionB
export const compareVersions = (versionA, versionB) => {
  if (versionA === versionB) {
    return 0;
  }

  let partsNumberA = versionA.split(".");
  let partsNumberB = versionB.split(".");

  for (let i = 0; i < partsNumberA.length; i++) {
    let valueA = parseInt(partsNumberA[i]);
    let valueB = parseInt(partsNumberB[i]);

    if (valueA > valueB || isNaN(valueB)) {
      return 1;
    }
    if (valueA < valueB) {
      return -1;
    }
  }
}
