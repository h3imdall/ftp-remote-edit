'use babel';

var ftpClient = require('ftp');

export default class Ftp {

  connect(connection) {
    const self = this;

    self.connection = connection;
    self.ftp = new ftpClient();

    let promise = new Promise((resolve, reject) => {
      self.ftp.on('ready', function () {
        self.conected = true;
        resolve(self);
      });

      self.ftp.on('error', (err) => {
        self.conected = false;
        self.client = null;
        reject(err);
      });

      self.ftp.on('end', (err) => {
        self.conected = false;
        self.client = null;
        resolve(null);
      });

      self.ftp.on('close', (err) => {
        self.conected = false;
        self.client = null;
        resolve(null);
      });

      self.ftp.connect(self.connection);
    });

    return promise;
  }

  list(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.ftp.list(remotePath.trim(), function (err, list) {
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
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.ftp.mkdir(remotePath.trim(), function (err) {
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
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.ftp.rmdir(remotePath.trim(), recursive, (err) => {
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
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.ftp.put(content, remotePath, function (err) {
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
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.ftp.get(remotePath, function (err, stream) {
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
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.ftp.delete(remotePath, function (err) {
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
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.ftp.rename(oldRemotePath.trim(), newRemotePath.trim(), function (err) {
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
    const self = this;

    self.ftp.end();
  }
}
