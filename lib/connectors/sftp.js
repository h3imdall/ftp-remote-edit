'use babel';

var sftpClient = require('./ssh2-sftp-client.js');
const FileSystem = require('fs-plus');
const EventEmitter = require('events');
const progress = require('progress-stream');

export default class Sftp extends EventEmitter {

  constructor(connection) {
    super();
    const self = this;

    self.connection = null;
  }

  connect(connection) {
    const self = this;
    self.emit('debug', 'sftp:connect');

    self.connection = connection;
    self.client = new sftpClient();

    self.client.on('ready', function () {
      self.emit('debug', 'sftp:connect:ready');
      this.emit('connected');
    });

    self.client.on('error', (err) => {
      self.emit('debug', 'sftp:connect:error');
      // self.emit('error', err);
    });

    self.client.on('end', () => {
      self.emit('debug', 'sftp:connect:end');
      self.emit('ended', 'Connection end');
    });

    self.client.on('close', (hadError) => {
      self.emit('debug', 'ftp:connect:close');
      self.emit('closed', 'Connection closed');
    });

    if (connection.privatekeyfile && !connection.privateKey) {
      if (FileSystem.existsSync(connection.privatekeyfile)) {
        connection.privateKey = FileSystem.readFileSync(connection.privatekeyfile, 'utf8');
      } else {
        return new Promise((resolve, reject) => {
          reject({ message: 'Private Keyfile not found...' });
        });
      }
    }
    if (connection.privateKey && !connection.passphrase) {
      connection.passphrase = connection.password;
    }

    return self.client.connect(connection).then(() => {
      self.connected = true;
      return new Promise((resolve, reject) => {
        resolve(self);
      });
    }).catch((err) => {
      self.connected = false;
      return new Promise((resolve, reject) => {
        reject(err);
      });
    });
  }

  isConnected() {
    const self = this;

    if (!self.client) return false;
    if (!self.client.sftp) return false;
    if (!self.client.sftp._stream) return false;
    return self.client.sftp._stream.readable;
  }

  list(remotePath) {
    const self = this;
    self.emit('debug', 'sftp:list', remotePath);

    let timer = null;

    // issue-76 Cannot connect to servers after resuming from suspend
    // sftp server don't react after loosing Connection
    // Workaround: Wait 10 sec, reconnect and try again
    // if the reconnection fails, throw error

    // reconnect and try list again
    let promiseA = new Promise((resolve, reject) => {
      timer = setTimeout(function () {
        return self.end().then(() => {
          return self.connect(self.connection).then(() => {
            return self.list(remotePath).then((list) => {
              resolve(list);
            }).catch((err) => {
              reject(err);
            });
          }).catch((err) => {
            reject(err);
          });
        }).catch((err) => {
          reject(err);
        });
      }, 10000);
    });

    // list
    let promiseB = self.client.list(remotePath).then((list) => {
      clearTimeout(timer);
      return new Promise((resolve, reject) => {
        resolve(list);
      });
    }).catch((err) => {
      clearTimeout(timer);
      return new Promise((resolve, reject) => {
        reject(err);
      });
    });

    return Promise.race([
      promiseA,
      promiseB
    ]);
  }

  mkdir(remotePath) {
    const self = this;
    self.emit('debug', 'sftp:mkdir', remotePath);

    return self.client.mkdir(remotePath).then(() => {
      return new Promise((resolve, reject) => {
        resolve(remotePath.trim());
      });
    }).catch((err) => {
      return new Promise((resolve, reject) => {
        reject(err);
      });
    });
  }

  rmdir(remotePath, recursive) {
    const self = this;
    self.emit('debug', 'sftp:rmdir', remotePath);

    return self.client.rmdir(remotePath, recursive).then(() => {
      return new Promise((resolve, reject) => {
        resolve(remotePath.trim());
      });
    }).catch((err) => {
      return new Promise((resolve, reject) => {
        reject(err);
      });
    });
  }

  chmod(remotePath, permissions) {
    const self = this;
    self.emit('debug', 'sftp:chmod', remotePath);

    return self.client.chmod(remotePath, permissions);
  }

  put(queueItem) {
    const self = this;

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    self.emit('debug', 'sftp:put', remotePath);

    let promise = new Promise((resolve, reject) => {
      let input = FileSystem.createReadStream(localPath);

      input.on('open', () => {
        queueItem.changeStatus('Transferring');
      });
      input.once('end', () => {
        queueItem.changeProgress(queueItem.info.size);
        resolve(localPath.trim());
      });
      input.once('finish', () => {
        queueItem.changeProgress(queueItem.info.size);
        resolve(localPath.trim());
      });
      input.once('error', (err) => {
        queueItem.changeStatus('Error');
        reject(err);
      });

      var str = progress({ time: 100 });
      str.on('progress', (progress) => {
        queueItem.changeProgress(progress.transferred);
        self.emit('data', progress.transferred);
      });

      self.client.on('close', function (hadError) {
        if (hadError) {
          queueItem.changeStatus('Error');
          reject(Error('sftp closed connection'));
        } else {
          resolve(localPath.trim());
        }
      });
      self.client.on('error', function (err) {
        queueItem.changeStatus('Error');
        reject(err);
      });

      // check file exists and get permissions
      return self.client.stat(remotePath).then((info) => {
        // file  exists
        let otherOptions = null;
        if (info.permissions) {
          otherOptions = { mode: parseInt('0' + info.permissions, 8) }
        } else {
          otherOptions = { mode: 0o644 }
        }

        return self.client.put(input, remotePath, null, null, otherOptions).then((stream) => {
          stream.once('end', () => {
            queueItem.changeProgress(queueItem.info.size);
            resolve(localPath.trim());
          });
          stream.once('finish', () => {
            queueItem.changeProgress(queueItem.info.size);
            resolve(localPath.trim());
          });
          stream.once('error', (err) => {
            queueItem.changeStatus('Error');
            reject(err);
          });

          input.pipe(str).pipe(stream);
        }).catch((err) => {
          queueItem.changeStatus('Error');
          reject(err);
        });
      }).catch((err) => {
        // file doesn't exists
        return self.client.put(input, remotePath, null, null, { mode: 0o644 }).then((stream) => {
          stream.once('end', () => {
            queueItem.changeProgress(queueItem.info.size);
            resolve(localPath.trim());
          });
          stream.once('finish', () => {
            queueItem.changeProgress(queueItem.info.size);
            resolve(localPath.trim());
          });
          stream.once('error', (err) => {
            queueItem.changeStatus('Error');
            reject(err);
          });

          input.pipe(str).pipe(stream);
        }).catch((err) => {
          queueItem.changeStatus('Error');
          reject(err);
        });
      });
    });

    return promise;
  }

  get(queueItem) {
    const self = this;

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    self.emit('debug', 'sftp:get', remotePath, localPath);

    let promise = new Promise((resolve, reject) => {
      var str = progress({ time: 100 });
      str.on('progress', (progress) => {
        queueItem.changeProgress(progress.transferred);
        self.emit('data', progress.transferred);
      });

      self.client.on('close', function (hadError) {
        if (hadError) {
          queueItem.changeStatus('Error');
          reject(Error('sftp closed connection'));
        } else {
          resolve(localPath.trim());
        }
      });
      self.client.on('error', function (err) {
        queueItem.changeStatus('Error');
        reject(err);
      });

      return self.client.get(remotePath, null, null).then((stream) => {
        let file = FileSystem.createWriteStream(localPath, { autoClose: true });

        file.on('open', (err) => {
          queueItem.addStream(file);
          queueItem.changeStatus('Transferring');
        });
        file.on('error', (err) => {
          queueItem.changeStatus('Error');
          reject(err);
        });

        stream.once('end', () => {
          queueItem.changeProgress(queueItem.info.size);
          resolve(localPath.trim());
        });
        stream.once('finish', () => {
          queueItem.changeProgress(queueItem.info.size);
          resolve(localPath.trim());
        });
        stream.once('error', (err) => {
          queueItem.changeStatus('Error');
          reject(err);
        });

        stream.pipe(str).pipe(file);
      }).catch((err) => {
        queueItem.changeStatus('Error');
        reject(err);
      });
    });

    return promise;
  }

  delete(remotePath) {
    const self = this;
    self.emit('debug', 'sftp:delete', remotePath);

    return self.client.delete(remotePath);
  }

  rename(oldRemotePath, newRemotePath) {
    const self = this;
    self.emit('debug', 'sftp:rename', oldRemotePath, newRemotePath);

    return self.client.rename(oldRemotePath, newRemotePath);
  }

  end() {
    const self = this;
    self.emit('debug', 'sftp:end');

    self.connected = false;
    return self.client.end();
  }
}
