'use babel';

var ftpClient = require('ftp');

export default class Ftp {

  connect(connection) {
    const self = this;

    self.connection = connection;
    self.ftp = new ftpClient();
    if (self.debug) console.log('ftp:connect');

    let promise = new Promise((resolve, reject) => {
      self.ftp.on('ready', function () {
        if (self.debug) console.log('ftp:connect:ready');
        resolve(self);
      });

      self.ftp.on('error', (err) => {
        if (self.debug) console.log('ftp:connect:error',err);
        reject(err);
      });

      self.ftp.on('end', () => {
        if (self.debug) console.log('ftp:connect:end');
        resolve(null);
      });

      self.ftp.on('close', (hadErr) => {
        if (self.debug) console.log('ftp:connect:close');
        if(hadErr){
          console.log(hadErr);
          reject({message: 'disconnected'});
        }
        resolve(null);
      });
    });

    self.ftp.connect(self.connection);

    return promise;
  }

  list(remotePath) {
    const self = this;
    if (self.debug) console.log('ftp:list',remotePath);

    let promise = new Promise((resolve, reject) => {
      try {
        self.ftp.list(remotePath.trim(), function (err, list) {
          if (err) {
            reject(err);
          } else {
            resolve(list);
          }
        });
      }
      catch(err) {
        reject(err);
      }
    });

    return promise;
  }

  mkdir(remotePath) {
    const self = this;
    if (self.debug) console.log('ftp:mkdir', remotePath);

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
    if (self.debug) console.log('ftp:rmdir', remotePath);

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
    if (self.debug) console.log('ftp:put', remotePath);

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
    if (self.debug) console.log('ftp:get', remotePath, localPath);

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
    if (self.debug) console.log('ftp:delete', remotePath);

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
    if (self.debug) console.log('ftp:rename', oldRemotePath, newRemotePath);

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
    if (self.debug) console.log('ftp:end');

    let promise = new Promise((resolve, reject) => {
      self.ftp.on('end', () => {
        if (self.debug) console.log('ftp:end:end');
        resolve(true);
      });

      self.ftp.on('close', (hadErr) => {
        if (self.debug) console.log('ftp:end:close');
        resolve(true);
      });

      self.ftp.end();
    });

    return promise;
  }
}
