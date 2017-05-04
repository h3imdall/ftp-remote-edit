'use babel';

var sftpClient = require('ssh2-sftp-client');

export default class Sftp extends sftpClient {

  connect(connection) {
    const self = this;
    
    let promise = new Promise((resolve, reject) => {

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
    
    if(pathOnDisk === null) {
        return super.put(Buffer.from([]), remotePath);
    } else {
        return super.put(pathOnDisk, remotePath);
    }
  }

  end() {

  }

}
