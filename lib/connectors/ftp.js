'use babel';

var ftpClient = require('ftp');

export default class Ftp {

  connect(connection) {
    const self = this;
    this.connection = connection;

    this.ftp = new ftpClient();

    let promise = new Promise((resolve, reject) => {

      this.ftp.on('ready', function () {
        self.conected = true;
        resolve(self);
      });

      this.ftp.on('error', (err) => {
        self.conected = false;
        self.client = null;
        reject(err);
      });

      this.ftp.on('end', (err) => {
        self.conected = false;
        self.client = null;
        resolve(null);
      });

      this.ftp.on('close', (err) => {
        self.conected = false;
        self.client = null;
        resolve(null);
      });

      this.ftp.connect(self.connection);
    });

    return promise;
  }

  list(remotePath) {
    let self = this;

    let promise = new Promise((resolve, reject) => {
      this.ftp.list(remotePath.trim(), function (err, list) {
        if (err) {
          reject(err);
        } else {
          resolve(list);
        }
      });
    });

    return promise;
  }

  mkdir(remotePath) {
    
    let promise = new Promise((resolve, reject) => {
      this.ftp.mkdir(remotePath.trim(), function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(remotePath.trim());
        }
      });
    });

    return promise;
  }

  rmdir(remotePath, recursive) {
    let promise = new Promise((resolve, reject) => {
      this.ftp.rmdir(remotePath.trim(), recursive, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(remotePath.trim());
        }
      });
    });

    return promise;
  }

  put(content, remotePath) {
    
    let promise = new Promise((resolve, reject) => {
      this.ftp.put(content, remotePath, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(remotePath.trim());
        }
      });
    });

    return promise;
  }

  get(remotePath, localPath) {
    
    let promise = new Promise((resolve, reject) => {
      this.ftp.get(remotePath, function (err, stream) {
        if (err) {
          reject(err);
        } else {
          resolve(stream);
        }
      });
    });

    return promise;
  }
  
  delete(remotePath) {
    
    let promise = new Promise((resolve, reject) => {
      this.ftp.delete(remotePath, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(remotePath.trim());
        }
      });
    });

    return promise;
  }

  rename(oldRemotePath, newRemotePath) {
    
    let promise = new Promise((resolve, reject) => {
      this.ftp.rename(oldRemotePath.trim(), newRemotePath.trim(), function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(newRemotePath.trim());
        }
      });
    });

    return promise;
  }

  end() {
    this.ftp.end();
  }
  
}
