'use babel';

const ftpClient = require('@icetee/ftp');
const EventEmitter = require('events');
const FileSystem = require('fs-plus');
const progress = require('progress-stream');

export default class Ftp extends EventEmitter {

  constructor() {
    super();

    self.clientReadyEvent = null;
    self.clientErrorEvent = null;
    self.clientEndEvent = null;
    self.clientCloseEvent = null;
  }

  connect(connection) {
    const self = this;
    self.emit('debug', 'ftp:connect');

    self.client = new ftpClient();
    let promise = new Promise((resolve, reject) => {
      self.clientReadyEvent = () => {
        // Not able to get directory listing for regular FTP to an IBM i (or AS/400 or iSeries) #123
        // Force IBM i (or AS/400 or iSeries) returns information
        // for the LIST subcommand in the UNIX style list format.
        self.client.site('LISTFMT 1', (err) => {});
 
        if (self.client._socket) {
          self.client._socket.setTimeout(1000 * 30); // 30 seconds

          self.client._socket.on('ready', () => {
            self.emit('debug', 'ftp:socket:ready');
          });
          self.client._socket.on('end', () => {
            self.emit('debug', 'ftp:socket:end');
            self.connected = false;
          });
          self.client._socket.on('close', () => {
            self.emit('debug', 'ftp:socket:close');
            self.connected = false;
          });
          self.client._socket.on('timeout', (err) => {
            self.emit('debug', 'ftp:socket:timeout');
            self.connected = false;
            self.client._socket.destroy();
            self.client.emit('timeout', new Error('Connection timeout'));
          });
        }

        self.emit('debug', 'ftp:connect:ready');
        self.connected = true;
        this.emit('connected');
        resolve(self);
      };
      self.client.on('ready', self.clientReadyEvent);

      self.clientErrorEvent = (err) => {
        self.emit('debug', 'ftp:connect:error', err);
        self.connected = self.client.connected;
        // self.emit('error', err);
        reject(err);
      };
      self.client.on('error', self.clientErrorEvent);

      self.clientEndEvent = () => {
        self.emit('debug', 'ftp:connect:end');
        self.connected = false;
        self.emit('log', '> Connection end');
        self.emit('ended', 'Connection end');
        reject({ message: 'Connection end' });
      };
      self.client.on('end', self.clientEndEvent);

      self.clientCloseEvent = (hadError) => {
        self.emit('debug', 'ftp:connect:close');
        self.connected = false;
        self.emit('log', '> Connection closed');
        self.emit('closed', 'Connection closed');
        reject({ message: 'Connection closed' });
      };
      self.client.on('close', self.clientCloseEvent);
    });

    connection.debug = (msg) => {
      let data = msg.split(/\[(.*)\] (>|<)(.*)/g);
      if (data[1] == "connection") {
        let direction = data[2];
        let cmd = data[3].replace(/\'+/g, "").replace(/\\r|\\n/g, " ");

        // mask password
        if (direction.trim() == ">") {
          let cmdparts = cmd.split(" ");
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
    if (!self.client._socket) return false;
    if (!self.client._socket.readable) return false;

    return self.connected;
  }

  list(remotePath) {
    const self = this;
    self.emit('debug', 'ftp:list', remotePath);

    const showHiddenFiles = atom.config.get('ftp-remote-edit.tree.showHiddenFiles');

    let promise = new Promise((resolve, reject) => {
      try {
        // Add event listener
        const clientTimeoutEvent = (err) => {
          reject(err);
        };
        self.client.once('timeout', clientTimeoutEvent);

        let path = (showHiddenFiles ? '-al ' + remotePath.trim() : remotePath.trim());
        self.client.list(path, (err, list) => {
          self.client.removeListener('timeout', clientTimeoutEvent);

          if (err) {
            reject(err);
          } else {
            resolve(list);
          }
        });
      } catch (err) {
        self.client.removeListener('timeout', clientTimeoutEvent);
        reject(err);
      }
    });

    return promise;
  }

  mkdir(remotePath) {
    const self = this;
    self.emit('debug', 'ftp:mkdir', remotePath);

    let promise = new Promise((resolve, reject) => {
      // Add event listener
      const clientTimeoutEvent = (err) => {
        reject(err);
      };
      self.client.once('timeout', clientTimeoutEvent);

      self.client.mkdir(remotePath.trim(), (err) => {
        self.client.removeListener('timeout', clientTimeoutEvent);

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
      // Add event listener
      const clientTimeoutEvent = (err) => {
        reject(err);
      };
      self.client.once('timeout', clientTimeoutEvent);

      self.client.rmdir(remotePath.trim(), recursive, (err) => {
        self.client.removeListener('timeout', clientTimeoutEvent);

        if (err) {
          reject(err);
        } else {
          resolve(remotePath.trim());
        }
      });
    });

    return promise;
  }

  chmod(remotePath, permissions) {
    const self = this;
    self.emit('debug', 'ftp:chmod', remotePath);

    let promise = new Promise((resolve, reject) => {
      // Add event listener
      const clientTimeoutEvent = (err) => {
        reject(err);
      };
      self.client.once('timeout', clientTimeoutEvent);

      self.client.site('CHMOD ' + permissions + ' ' + remotePath, (err, responseText, responseCode) => {
        self.client.removeListener('timeout', clientTimeoutEvent);

        if (err) {
          reject(err);
        } else {
          resolve(responseText);
        }
      });
    });

    return promise;
  }

  put(queueItem) {
    const self = this;
    self.emit('debug', 'ftp:put', remotePath);

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
          reject(Error('ftp closed connection'));
        } else {
          resolve(localPath.trim());
        }
      };
      const clientErrorEvent = (err) => {
        queueItem.changeStatus('Error');
        reject(err);
      };
      const clientTimeoutEvent = (err) => {
        queueItem.changeStatus('Error');
        reject(err);
      };
     
      // Add event listener
      str.on('progress', progressEvent);
      self.client.once('close', clientCloseEvent);
      self.client.once('error', clientErrorEvent);
      self.client.once('timeout', clientTimeoutEvent);

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
        self.client.removeListener('timeout', clientTimeoutEvent);

        queueItem.changeStatus('Error');
        reject(err);
      });

      self.client.put(input.pipe(str), remotePath, false, (err) => {
        if (err) {
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);
          self.client.removeListener('timeout', clientTimeoutEvent);

          queueItem.changeStatus('Error');
          reject(err);
        } else {
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);
          self.client.removeListener('timeout', clientTimeoutEvent);

          queueItem.changeProgress(queueItem.info.size);
          resolve(remotePath.trim());
        }
      });
    });

    return promise;
  }

  get(queueItem) {
    const self = this;
    self.emit('debug', 'ftp:get', remotePath, localPath);

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    let promise = new Promise((resolve, reject) => {
      let str = progress({ time: 100 });

      // Declare events  
      const progressEvent = (progress) => {
        queueItem.changeProgress(progress.transferred);
        self.emit('data', progress.transferred);
      };
      const clientCloseEvent = (hadError) => {
        if (hadError) {
          queueItem.changeStatus('Error');
          reject(Error('ftp closed connection'));
        } else {
          resolve(localPath.trim());
        }
      };
      const clientErrorEvent = (err) => {
        queueItem.changeStatus('Error');
        reject(err);
      };
      const clientTimeoutEvent = (err) => {
        queueItem.changeStatus('Error');
        reject(err);
      };

      // Add event listener
      str.on('progress', progressEvent);
      self.client.once('close', clientCloseEvent);
      self.client.once('error', clientErrorEvent);
      self.client.once('timeout', clientTimeoutEvent);

      self.client.get(remotePath, (err, stream) => {
        if (err) {
          // Remove event listener
          str.removeListener('progress', progressEvent);
          self.client.removeListener('close', clientCloseEvent);
          self.client.removeListener('error', clientErrorEvent);
          self.client.removeListener('timeout', clientTimeoutEvent);

          queueItem.changeStatus('Error');
          reject(err);
        } else {
          let file = FileSystem.createWriteStream(localPath, { autoClose: true });

          file.once('open', () => {
            queueItem.addStream(file);
            queueItem.changeStatus('Transferring');
          });
          file.once('error', (err) => {
            // Remove event listener
            str.removeListener('progress', progressEvent);
            self.client.removeListener('close', clientCloseEvent);
            self.client.removeListener('error', clientErrorEvent);
            self.client.removeListener('timeout', clientTimeoutEvent);

            queueItem.changeStatus('Error');
            reject(err);
          });

          stream.once('end', () => {
            // Remove event listener
            str.removeListener('progress', progressEvent);
            self.client.removeListener('close', clientCloseEvent);
            self.client.removeListener('error', clientErrorEvent);
            self.client.removeListener('timeout', clientTimeoutEvent);

            queueItem.changeProgress(queueItem.info.size);
            resolve(localPath.trim());
          });
          stream.once('finish', () => {
            // Remove event listener
            str.removeListener('progress', progressEvent);
            self.client.removeListener('close', clientCloseEvent);
            self.client.removeListener('error', clientErrorEvent);
            self.client.removeListener('timeout', clientTimeoutEvent);

            queueItem.changeProgress(queueItem.info.size);
            resolve(localPath.trim());
          });
          stream.once('error', (err) => {
            // Remove event listener
            str.removeListener('progress', progressEvent);
            self.client.removeListener('close', clientCloseEvent);
            self.client.removeListener('error', clientErrorEvent);
            self.client.removeListener('timeout', clientTimeoutEvent);

            queueItem.changeStatus('Error');
            reject(err);
          });

          stream.pause();
          stream.pipe(str).pipe(file);
        }
      });
    });

    return promise;
  }

  delete(remotePath) {
    const self = this;
    self.emit('debug', 'ftp:delete', remotePath);

    let promise = new Promise((resolve, reject) => {
      // Add event listener
      const clientTimeoutEvent = (err) => {
        reject(err);
      };
      self.client.once('timeout', clientTimeoutEvent);

      self.client.delete(remotePath, (err) => {
        self.client.removeListener('timeout', clientTimeoutEvent);

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
      // Add event listener
      const clientTimeoutEvent = (err) => {
        reject(err);
      };
      self.client.once('timeout', clientTimeoutEvent);

      self.client.rename(oldRemotePath.trim(), newRemotePath.trim(), (err) => {
        self.client.removeListener('timeout', clientTimeoutEvent);
        
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
      if (!self.client) return resolve(true);

      // Declare events  
      const clientEndEvent = () => {
        self.emit('debug', 'ftp:end');

        // Remove event listener
        self.client.removeListener('end', clientEndEvent);
        self.client.removeListener('close', clientCloseEvent);

        self.client.removeListener('ready', self.clientReadyEvent);
        self.client.removeListener('error', self.clientErrorEvent);
        self.client.removeListener('end', self.clientEndEvent);
        self.client.removeListener('close', self.clientCloseEvent);
        resolve(true);
      };
      const clientCloseEvent = (hadError) => {
        self.emit('debug', 'ftp:end');

        resolve(true);
      };

      // Add event listener
      self.client.on('end', clientEndEvent);
      self.client.on('close', clientCloseEvent);

      self.client.end();
    });

    return promise;
  }

  abort() {
    const self = this;
    self.emit('debug', 'ftp:abort');

    let promise = new Promise((resolve, reject) => {
      if (!self.client) return resolve(true);

      self.client.abort((err) => {
        resolve();
      });
    });

    return promise;
  }
}
