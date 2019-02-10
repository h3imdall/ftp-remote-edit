'use babel';

export const cleanJsonString = (jsonstring) => {
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
  jsonstring = jsonstring.replace(/[\u0000-\u001F]+/g, '');

  return jsonstring;
}

export const basename = (path, sep = '/') => {
  return trailingslashit(path, sep).split(sep).pop();
}

export const dirname = (path, sep = '/') => {
  let arrPath = trailingslashit(path, sep).split(sep);
  arrPath.pop();
  return untrailingslashit(arrPath.join(sep), sep);
}

export const trailingslashit = (path, sep = '/') => {
  if (sep == '/') {
    if (path == '/') return path;
    return path.replace(/\/$/, '');
  } else {
    if (path == '\\') return path;
    return path.replace(/\\$/, '');
  }
}

export const untrailingslashit = (path, sep = '/') => {
  path = trailingslashit(path, sep);
  return path + sep;
}

export const leadingslashit = (path, sep = '/') => {
  if (sep == '/') {
    if (path == '/') return path;
    return path.replace(/^\/+/, '');
  } else {
    if (path == '\\') return path;
    return path.replace(/^\\/, '');
  }
}

export const unleadingslashit = (path, sep = '/') => {
  path = leadingslashit(path, sep);
  return sep + path;
}

export const normalize = (path, sep = '/') => {
  if (!path) return '';
  path = path.trim();
  
  if (sep == '/') {
    if (path == '/') return path;
    return path.replace(/\\+/g, "/").replace(/\/+/g, "/").split('/').map((item) => {
      return item.trim();
    }).join('/')
  } else {
    if (path == '\\') return path;
    return path.replace(/\/+/g, "\\").replace(/\\+/g, "\\").split('\\').map((item) => {
      return item.trim();
    }).join('\\');
  }
}

export const formatNumber = (num) => {
  return String(num).replace(/(.)(?=(\d{3})+$)/g, '$1.');
}
