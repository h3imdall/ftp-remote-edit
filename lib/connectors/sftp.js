'use babel';

import Ftp from './ftp.js';
import { File } from 'atom';
var sftpClient = require('ssh2-sftp-client');

export default class Sftp extends Ftp {

  connect() {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      var Client = new sftpClient();

      Client.on('ready', function () {
        resolve(Client);
      });

      Client.on('error', (err) => {
        self.showMessage(err.message, 'error');
        reject(err);
      });

      Client.connect(self.connection);
    });

    return promise;
  }
}
