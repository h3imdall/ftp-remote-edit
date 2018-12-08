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
  jsonstring = jsonstring.replace(/[\u0000-\u001F]+/g, "");

  return jsonstring;
}

export const basename = (path, sep = '/') => {
  if (sep == '/') {
    let arrPath = path.replace(/\/$/, "").split('/');
    return arrPath.pop();
  } else {
    let arrPath = path.replace(/\\$/, "").split('\\');
    return arrPath.pop();
  }
}

export const dirname = (path, sep = '/') => {
  if (sep == '/') {
    let arrPath = path.replace(/\/$/, "").split('/');
    arrPath.pop();
    return arrPath.join('/') + '/';
  } else {
    let arrPath = path.replace(/\\$/, "").split('\\');
    arrPath.pop();
    return arrPath.join('\\') + '\\';
  }
}

export const trailingslashit = (path, sep = '/') => {
  if (sep == '/') {
    if (path == '/') return path;
    return path.replace(/\/$/, "");
  } else {
    if (path == '\\') return path;
    return path.replace(/\\$/, "");
  }
}

export const normalize = (path, sep = '/') => {
  if (sep == '/') {
    if (path == '/') return path;
    return path.replace(/\\+/g, "/").replace(/\/+/g, "/");
  } else {
    if (path == '\\') return path;
    return path.replace(/\/+/g, "\\").replace(/\\+/g, "\\");
  }
}

export const formatNumber = (num) => {
  return String(num).replace(/(.)(?=(\d{3})+$)/g, '$1.');
}