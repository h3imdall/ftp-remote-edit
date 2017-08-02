'use babel';

var ftpClient = require('ftp');
const EventEmitter = require('events');

export default class Ftp extends EventEmitter {

  connect(connection) {
    const self = this;
    self.emit('debug', 'ftp:connect');

    self.client = new ftpClient();
    let promise = new Promise((resolve, reject) => {
      self.client.on('ready', function () {
        self.emit('debug', 'ftp:connect:ready');
        self.connected = self.client.connected;
        resolve(self);
      });

      self.client.on('error', (err) => {
        self.emit('debug', 'ftp:connect:error', err);
        self.connected = self.client.connected;
        reject(err);
      });

      self.client.on('end', () => {
        self.emit('debug', 'ftp:connect:end');
        self.connected = self.client.connected;
        resolve(null);
      });

      self.client.on('close', (hadErr) => {
        self.emit('debug', 'ftp:connect:close');
        self.connected = self.client.connected;
        if (hadErr) {
          reject({ message: 'disconnected' });
        }
        resolve(null);
      });
    });

    connection.debug = function (msg) {
      let data = msg.split(/\[(.*)\] (>|<)(.*)/g);
      if (data[1] == "connection") {
        let direction = data[2];
        let cmd = data[3].replace(/\'+/g, "")
          .replace(/\\r|\\n/g, " ");

        // mask password
        if (direction.trim() == ">") {
          let cmdparts = cmd.split(" ");console.log(cmdparts);
          if (cmdparts[1] == "PASS") {
            cmd = cmdparts[1] + " " + '*'.repeat(cmdparts[2].length);
          }
        }

        self.emit('log', direction + ' ' + cmd);
      }
    }

    self.client.connect(connection);

    return promise;
  }

  isConnected() {
    const self = this;

    if (!self.client) return false;
    return self.connected;
  }

  list(remotePath) {
    const self = this;
    self.emit('debug', 'ftp:list', remotePath);

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
    self.emit('debug', 'ftp:mkdir', remotePath);

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
    self.emit('debug', 'ftp:rmdir', remotePath);

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
    self.emit('debug', 'ftp:put', remotePath);

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
    self.emit('debug', 'ftp:get', remotePath, localPath);

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
    self.emit('debug', 'ftp:delete', remotePath);

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
    self.emit('debug', 'ftp:rename', oldRemotePath, newRemotePath);

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
    self.emit('debug', 'ftp:end');

    self.connected = false;
    let promise = new Promise((resolve, reject) => {
      self.client.on('end', () => {
        self.emit('debug', 'ftp:end:end');
        self.connected = false;
        resolve(true);
      });

      self.client.on('close', (hadErr) => {
        self.emit('debug', 'ftp:end:close');
        self.connected = false;
        resolve(true);
      });

      self.client.destroy();
    });

    return promise;
  }
}
