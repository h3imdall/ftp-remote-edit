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
    let arrPath = path.replace(/\/$/, "")
      .split('/');
    return arrPath.pop();
  } else {
    let arrPath = path.replace(/\\$/, "")
      .split('\\');
    return arrPath.pop();
  }
};

export const dirname = function (path, sep = '/') {
  if (sep == '/') {
    let arrPath = path.replace(/\/$/, "")
      .split('/');
    arrPath.pop();
    return arrPath.join('/') + '/';
  } else {
    let arrPath = path.replace(/\\$/, "")
      .split('\\');
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
  return String(num)
    .replace(/(.)(?=(\d{3})+$)/g, '$1.');
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
