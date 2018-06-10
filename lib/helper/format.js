'use babel';

export const cleanJsonString = function (jsonstring) {
  // http://stackoverflow.com/questions/14432165/uncaught-syntaxerror-unexpected-token-with-json-parse

  if (jsonstring === null) return '';

  // preserve newlines, etc - use valid JSON
  jsonstring = jsonstring.replace(/\\n/g, "\\n")
    .replace(/\\'/g, "\\'")
    .replace(/\\"/g, '\\"')
    .replace(/\\&/g, "\\&")
    .replace(/\\r/g, "\\r")
    .replace(/\\t/g, "\\t")
    .replace(/\\b/g, "\\b")
    .replace(/\\f/g, "\\f");
  // remove non-printable and other non-valid JSON chars
  jsonstring = jsonstring.replace(/[\u0000-\u001F]+/g, "");

  return jsonstring;
};

export const basename = function (path, sep = '/') {
  if (sep == '/') {
    let arrPath = path.replace(/\/$/, "").split('/');
    return arrPath.pop();
  } else {
    let arrPath = path.replace(/\\$/, "").split('\\');
    return arrPath.pop();
  }
};

export const dirname = function (path, sep = '/') {
  if (sep == '/') {
    let arrPath = path.replace(/\/$/, "").split('/');
    arrPath.pop();
    return arrPath.join('/') + '/';
  } else {
    let arrPath = path.replace(/\\$/, "").split('\\');
    arrPath.pop();
    return arrPath.join('\\') + '\\';
  }
};

export const trailingslashit = function (path, sep = '/') {
  if (sep == '/') {
    if (path == '/') return path;
    return path.replace(/\/$/, "");
  } else {
    if (path == '\\') return path;
    return path.replace(/\\$/, "");
  }
};

export const normalize = function (path, sep = '/') {
  if (sep == '/') {
    if (path == '/') return path;
    return path.replace(/\\+/g, "/").replace(/\/+/g, "/");
  } else {
    if (path == '\\') return path;
    return path.replace(/\/+/g, "\\").replace(/\\+/g, "\\");
  }
};

export const formatNumber = function (num) {
  return String(num).replace(/(.)(?=(\d{3})+$)/g, '$1.');
};

export const highlight = function (path, matches, offsetIndex) {
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
};

export const rightsToPermissions = function (rights) {
  const self = this;

  if (!rights) return;

  let user = rights.user.split('');
  let group = rights.group.split('');
  let other = rights.other.split('');

  let permissionsuser = 0;
  let permissionsgroup = 0;
  let permissionsother = 0;

  user.forEach(function (right) {
    if (right == 'r') permissionsuser += 4;
    if (right == 'w') permissionsuser += 2;
    if (right == 'x') permissionsuser += 1;
  });

  group.forEach(function (right) {
    if (right == 'r') permissionsgroup += 4;
    if (right == 'w') permissionsgroup += 2;
    if (right == 'x') permissionsgroup += 1;
  });

  other.forEach(function (right) {
    if (right == 'r') permissionsother += 4;
    if (right == 'w') permissionsother += 2;
    if (right == 'x') permissionsother += 1;
  });

  return permissionsuser.toString() + permissionsgroup.toString() + permissionsother.toString();
}

export const permissionsToRights = function (permissions) {
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
