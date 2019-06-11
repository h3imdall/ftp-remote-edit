'use babel';

import sftpClient from './../helper/ssh2-sftp-client';

const FileSystem = require('fs-plus');
const EventEmitter = require('events');
const progress = require('progress-stream');

export default class Sftp extends EventEmitter {

  constructor() {
    super();
    const self = this;

    self.connection = null;
    self.clientReadyEvent = null;
    self.clientErrorEvent = null;
    self.clientEndEvent = null;
    self.clientCloseEvent = null;
  }

  connect(connection) {
    const self = this;
    self.emit('debug', 'sftp:connect');

    self.connection = connection;
    self.client = new sftpClient();

    // add remove listener support, because it's not implemented in lib
    self.client.removeListener = function (eventType, callback) {
      self.client.client.removeListener(eventType, callback);
    };

    self.clientReadyEvent = () => {
      self.emit('debug', 'sftp:connect:ready');
      this.emit('connected');
    };
    self.client.on('ready', self.clientReadyEvent);

    self.clientErrorEvent = (err) => {
      self.emit('debug', 'sftp:connect:error');
      // self.emit('error', err);
    };
    self.client.on('error', self.clientErrorEvent);

    self.clientEndEvent = () => {
      self.emit('debug', 'sftp:connect:end');
      self.emit('ended', 'Connection end');
    };
    self.client.on('end', self.clientEndEvent);

    self.clientCloseEvent = () => {
      self.emit('debug', 'sftp:connect:close');
      self.emit('closed', 'Connection closed');
    };
    self.client.on('close', self.clientCloseEvent);

    let pw = true;
    if (connection.useAgent) {
      let agent = self.getSshAgent();
      if (agent) {
        connection.agent = agent;
        pw = false;
      } else {
        atom.notifications.addWarning('No SSH agent found.', {
          description: 'Falling back to keyfile or password based authentication.'
        });
      }
    }
    if (pw && connection.privatekeyfile && !connection.privateKey) {
      if (FileSystem.existsSync(connection.privatekeyfile)) {
        connection.privateKey = FileSystem.readFileSync(connection.privatekeyfile, 'utf8');
      } else {
        return new Promise((resolve, reject) => {
          reject({ message: 'Private Keyfile not found...' });
        });
      }
    }
    if (pw && connection.privateKey && !connection.passphrase) {
      connection.passphrase = connection.password;
    }

    connection.debug = (msg) => {
      if (!msg.includes('DEBUG: Parser')) {
        self.emit('debug', msg.replace('DEBUG:', 'sftp:debug:'));
      }
    }

    return self.client.connect(connection).then(() => {
      return new Promise((resolve, reject) => {
        resolve(self);
      });
    }).catch((err) => {
      return new Promise((resolve, reject) => {
        reject(err);
      });
    });
  }

  getSshAgent() {
    let sock = process.env['SSH_AUTH_SOCK']
    if (sock) {
      return sock
    } else {
      if (process.platform == 'win32') {
        return 'pageant'
      } else {
        return null
      }
    }
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
      timer = setTimeout(() => {
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
    self.emit('debug', 'sftp:put', remotePath);

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    let promise = new Promise((resolve, reject) => {
      let str = progress({ time: 100 });
      let input = FileSystem.createReadStream(localPath);
      input.pause();

      // Declare events  
      const progressEvent = (progress) => {
        queueItem.changeProgress(progress.transferred);
        self.emit('data', progress.transferred);
      };
      const clientCloseEvent = (hadError) => {
        if (hadError) {
          queueItem.changeStatus('Error');
          reject(Error('sftp closed connection'));
        } else {
          resolve(localPath.trim());
        }
      };
      const clientErrorEvent = (err) => {
        queueItem.changeStatus('Error');
        reject(err);
      };

      // Add event listener
      str.on('progress', progressEvent);
      self.client.on('close', clientCloseEvent);
      self.client.on('error', clientErrorEvent);

      input.on('open', () => {
        queueItem.changeStatus('Transferring');
      });
      // input.once('end', () => {
      //   queueItem.changeProgress(queueItem.info.size);
      //   resolve(localPath.trim());
      // });
      // input.once('finish', () => {
      //   queueItem.changeProgress(queueItem.info.size);
      //   resolve(localPath.trim());
      // });
      input.once('error', (err) => {
        // Remove event listener
        str.removeListener('progress', progressEvent);
        self.client.removeListener('close', clientCloseEvent);
        self.client.removeListener('error', clientErrorEvent);

        queueItem.changeStatus('Error');
        reject(err);
      });

      // check file exists and get permissions
      return self.client.stat(remotePath).then((info) => {
        // file  exists
        let otherOptions = null;
        if (info.permissions) {
          info.permissions = info.permissions.toString(8).substr(-3);
          otherOptions = { mode: parseInt('0' + info.permissions, 8) }
        } else {
          otherOptions = { mode: 0o644 }
        }

        return self.client.put(input.pipe(str), remotePath, null, null, otherOptions).then(() => {
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);

          queueItem.changeProgress(queueItem.info.size);
          resolve(localPath.trim());
        }).catch((err) => {
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);

          queueItem.changeStatus('Error');
          reject(err);
        });
      }).catch((err) => {
        // file doesn't exists
        return self.client.put(input.pipe(str), remotePath, null, null, { mode: 0o644 }).then(() => {
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);

          queueItem.changeProgress(queueItem.info.size);
          resolve(localPath.trim());
        }).catch((err) => {
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);

          queueItem.changeStatus('Error');
          reject(err);
        });
      });
    });

    return promise;
  }

  get(queueItem) {
    const self = this;
    self.emit('debug', 'sftp:get', remotePath, localPath);

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    let promise = new Promise((resolve, reject) => {
      let str = progress({ time: 100 });

      // Declare events  
      const progressEvent = (progress) => {
        self.emit('debug', 'sftp:get:client.get:progress');
        queueItem.changeProgress(progress.transferred);
        self.emit('data', progress.transferred);
      };
      const clientCloseEvent = (hadError) => {
        if (hadError) {
          queueItem.changeStatus('Error');
          reject(Error('sftp closed connection'));
        } else {
          resolve(localPath.trim());
        }
      };
      const clientErrorEvent = (err) => {
        queueItem.changeStatus('Error');
        reject(err);
      };

      // Add event listener
      str.on('progress', progressEvent);
      self.client.on('close', clientCloseEvent);
      self.client.on('error', clientErrorEvent);

      return self.client.get(remotePath, null, null).then((stream) => {
        stream.pause();

        stream.on('readable', () => {
          self.emit('debug', 'sftp:get:stream.readable');

        });

        self.emit('debug', 'sftp:get:client.get:success');
        let file = FileSystem.createWriteStream(localPath, { autoClose: true });

        file.on('open', (err) => {
          self.emit('debug', 'sftp:get:file.open');
          queueItem.addStream(file);
          queueItem.changeStatus('Transferring');
        });
        file.on('error', (err) => {
          self.emit('debug', 'sftp:get:file.error');
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);

          queueItem.changeStatus('Error');
          reject(err);
        });
        file.once('finish', () => {
          self.emit('debug', 'sftp:get:file.finish');
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);

          queueItem.changeProgress(queueItem.info.size);
          resolve(localPath.trim());
        });

        stream.once('end', () => {
          self.emit('debug', 'sftp:get:stream.end');
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);

          queueItem.changeProgress(queueItem.info.size);
          resolve(localPath.trim());
        });
        stream.once('finish', () => {
          self.emit('debug', 'sftp:get:stream.finish');
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);

          queueItem.changeProgress(queueItem.info.size);
          resolve(localPath.trim());
        });
        stream.once('error', (err) => {
          self.emit('debug', 'sftp:get:stream.error');
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);

          queueItem.changeStatus('Error');
          reject(err);
        });

        self.emit('debug', 'sftp:get:stream.pipe');
        stream.pipe(str).pipe(file);
      }).catch((err) => {
        self.emit('debug', 'sftp:get:client.get:error');
        // Remove event listener
        str.removeListener('progress', progressEvent);
        self.client.removeListener('close', clientCloseEvent);
        self.client.removeListener('error', clientErrorEvent);

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

    // Remove event listener
    self.client.removeListener('ready', self.clientReadyEvent);
    self.client.removeListener('error', self.clientErrorEvent);
    self.client.removeListener('end', self.clientEndEvent);
    self.client.removeListener('close', self.clientCloseEvent);

    return self.client.end();
  }

  abort() {
    const self = this;
    self.emit('debug', 'sftp:abort');

    return self.end().then(() => {
      return self.connect(self.connection)
    });
  }
}
