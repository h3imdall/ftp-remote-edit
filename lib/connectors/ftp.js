'use babel';

var ftpClient = require('ftp');

export default class Ftp {

  connect(connection) {
    const self = this;
    if (self.debug) console.log('ftp:connect');

    self.client = new ftpClient();
    let promise = new Promise((resolve, reject) => {
      self.client.on('ready', function () {
        if (self.debug) console.log('ftp:connect:ready');
        self.connected = self.client.connected;
        resolve(self);
      });

      self.client.on('error', (err) => {
        if (self.debug) console.log('ftp:connect:error', err);
        self.connected = self.client.connected;
        reject(err);
      });

      self.client.on('end', () => {
        if (self.debug) console.log('ftp:connect:end');
        self.connected = self.client.connected;
        resolve(null);
      });

      self.client.on('close', (hadErr) => {
        if (self.debug) console.log('ftp:connect:close');
        self.connected = self.client.connected;
        if (hadErr) {
          console.log(hadErr);
          reject({ message: 'disconnected' });
        }
        resolve(null);
      });
    });

    self.client.connect(connection);

    return promise;
  }

  isConnected() {
    const self = this;
    
    if(!self.client) return false;
    return self.connected;
  }

  list(remotePath) {
    const self = this;
    if (self.debug) console.log('ftp:list', remotePath);

    let promise = new Promise((resolve, reject) => {
      try {
        self.client.list(remotePath.trim(), function (err, list) {
          if (err) {
            reject(err);
          } else {
            resolve(list);
          }
        });
      } catch (err) {
        reject(err);
      }
    });

    return promise;
  }

  mkdir(remotePath) {
    const self = this;
    if (self.debug) console.log('ftp:mkdir', remotePath);

    let promise = new Promise((resolve, reject) => {
      self.client.mkdir(remotePath.trim(), function (err) {
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
      self.client.rmdir(remotePath.trim(), recursive, (err) => {
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
      self.client.put(content, remotePath, function (err) {
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
      self.client.get(remotePath, function (err, stream) {
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
      self.client.delete(remotePath, function (err) {
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
      self.client.rename(oldRemotePath.trim(), newRemotePath.trim(), function (err) {
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

    self.connected = false;
    let promise = new Promise((resolve, reject) => {
      self.client.on('end', () => {
        if (self.debug) console.log('ftp:end:end');
        self.connected = false;
        resolve(true);
      });

      self.client.on('close', (hadErr) => {
        if (self.debug) console.log('ftp:end:close');
        self.connected = false;
        resolve(true);
      });

      self.client.destroy();
    });

    return promise;
  }
}
