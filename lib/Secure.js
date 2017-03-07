'use babel';

// import { View } from 'atom';
// import { CompositeDisposable } from 'atom';


var crypto = require('crypto');

export default class Secure  {

  constructor() {
    // Create root element
  }

  decrypt (password, text) {
    var decipher = crypto.createDecipher('aes-256-ctr', password);
    var dec = decipher.update(text, 'hex', 'utf8');
    return dec;
  }

  encrypt (password, text) {
    var cipher = crypto.createCipher('aes-256-ctr', password);
    var crypted = cipher.update(text, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
  }

  checkPassword (password) {
    let passwordHash = atom.config.get('ftp-remote-edit.password');

    if(this.decrypt(password, passwordHash) !== password) {
        return false;
    }
    return true;
  }


}
