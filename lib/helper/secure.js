'use babel';

var crypto = require('crypto');

export const decrypt = function (password, text) {
  var decipher = crypto.createDecipher('aes-256-ctr', password);
  var dec = decipher.update(text, 'hex', 'utf8');
  return dec;
};

export const encrypt = function (password, text) {
  var cipher = crypto.createCipher('aes-256-ctr', password);
  var crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
};

export const checkPassword = function (password) {
  let passwordHash = atom.config.get('ftp-remote-edit.password');
  if (!passwordHash) return true;

  if (decrypt(password, passwordHash) !== password) {
    return false;
  }

  return true;
};

export const setPassword = function (password) {
  const self = this;

  let promise = new Promise((resolve, reject) => {
    if (checkPassword(password)) {
      let passwordHash = encrypt(password, password);

      // Store in atom config
      atom.config.set('ftp-remote-edit.password', passwordHash);

      resolve(true);
    }

    reject(false);
  });

  return promise;
}
