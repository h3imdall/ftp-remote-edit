'use babel';

export const cleanJsonString = function (jsonstring) {
  // http://stackoverflow.com/questions/14432165/uncaught-syntaxerror-unexpected-token-with-json-parse

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

export const getStyleObject = function(el) {
   var camelizedAttr, property, results, styleObject, styleProperties, value;
   styleProperties = window.getComputedStyle(el);
   styleObject = {};
   results = [];
   for (property in styleProperties) {
     value = styleProperties.getPropertyValue(property);
     camelizedAttr = property.replace(/\-([a-z])/g, function(a, b) {
       return b.toUpperCase();
     });
     styleObject[camelizedAttr] = value;
     results.push(styleObject);
   }
   return results;
 }
