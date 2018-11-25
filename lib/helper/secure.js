'use babel';

const crypto = require('crypto');

export const decrypt = (password, text) => {
  try {
    let decipher = crypto.createDecipher('aes-256-ctr', password);
    let dec = decipher.update(text, 'hex', 'utf8');
    return dec;
  } catch (e) {
    return null;
  }
}

export const encrypt = (password, text) => {
  try {
    let cipher = crypto.createCipher('aes-256-ctr', password);
    let crypted = cipher.update(text, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
  } catch (e) {
    return null;
  }
}

export const checkPasswordExists = () => {
  const self = this;

  let passwordHash = atom.config.get('ftp-remote-edit.password');
  if (passwordHash) return true;

  return false;
}

export const checkPassword = (password) => {
  let passwordHash = atom.config.get('ftp-remote-edit.password');
  if (!passwordHash) return true;

  if (decrypt(password, passwordHash) !== password) {
    return false;
  }

  return true;
}

export const setPassword = (password) => {
  const self = this;

  let promise = new Promise((resolve, reject) => {
    let passwordHash = encrypt(password, password);

    // Store in atom config
    atom.config.set('ftp-remote-edit.password', passwordHash);

    resolve(true);
  });

  return promise;
}

export const changePassword = (oldPassword, newPassword) => {
  const self = this;

  let promise = new Promise((resolve, reject) => {
    let passwordHash = encrypt(newPassword, newPassword);

    // Store in atom config
    atom.config.set('ftp-remote-edit.password', passwordHash);

    let configHash = atom.config.get('ftp-remote-edit.config');
    if (configHash) {
      let oldconfig = decrypt(oldPassword, configHash);
      let newconfig = encrypt(newPassword, oldconfig);
      // Store in atom config
      atom.config.set('ftp-remote-edit.config', newconfig);
    }

    resolve(true);
  });

  return promise;
}

export const b64EncodeUnicode = (str) => {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode('0x' + p1);
  }));
}

export const b64DecodeUnicode = (str) => {
  return decodeURIComponent(atob(str).split('').map((c) => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}
