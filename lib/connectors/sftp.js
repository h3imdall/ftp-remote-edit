'use babel';

var sftpClient = require('ssh2-sftp-client');
var FileSystem = require('fs');

export default class Sftp extends sftpClient {

  connect(connection) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      if (connection.privatekeyfile && !connection.privateKey) {
        if (FileSystem.existsSync(connection.privatekeyfile)) {
          connection.privateKey  = FileSystem.readFileSync(connection.privatekeyfile, 'utf8');
        }else{
          reject({message: 'Private Keyfile not found...'});
          return;
        }
      }

      if(connection.privateKey  && !connection.passphrase){
        connection.passphrase = connection.password;
      }

      super.connect(connection)
        .then(() => {
          resolve(self);
        })
        .catch((err) => {
          reject(err);
        });
    });

    return promise;
  }

  put(content, remotePath, pathOnDisk) {
    if (pathOnDisk === null) {
      return super.put(Buffer.from([]), remotePath);
    } else {
      return super.put(pathOnDisk, remotePath);
    }
  }

  end() {
    return new Promise((resolve, reject) => {
      resolve(true);
    });
  }
}
