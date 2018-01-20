'use babel';

var ftpClient = require('@icetee/ftp');
const EventEmitter = require('events');
const FileSystem = require('fs-plus');

export default class Ftp extends EventEmitter {

  constructor(connection) {
    super();
    const self = this;

    self.setMaxListeners(0);
  }

  connect(connection) {
    const self = this;
    self.emit('debug', 'ftp:connect');

    self.client = new ftpClient();
    let promise = new Promise((resolve, reject) => {
      self.client.on('ready', function () {

        // Not able to get directory listing for regular FTP to an IBM i (or AS/400 or iSeries) #123
        // Force IBM i (or AS/400 or iSeries) returns information
        // for the LIST subcommand in the UNIX style list format.
        self.client.site('LISTFMT 1', function (err) {});

        self.emit('debug', 'ftp:connect:ready');
        self.connected = self.client.connected;
        this.emit('connected');
        resolve(self);
      });

      self.client.on('error', (err) => {
        self.emit('debug', 'ftp:connect:error', err);
        self.connected = self.client.connected;
        // self.emit('error', err);
        reject(err);
      });

      self.client.on('end', () => {
        self.emit('debug', 'ftp:connect:end');
        self.connected = self.client.connected;
        self.emit('log', '> Connection end');
        self.emit('ended', 'Connection end');
        reject({ message: 'Connection end' });
      });

      self.client.on('close', (hadErr) => {
        self.emit('debug', 'ftp:connect:close');
        self.connected = self.client.connected;
        self.emit('log', '> Connection closed');
        self.emit('closed', 'Connection closed');
        reject({ message: 'Connection closed' });
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
    return self.connected;
  }

  list(remotePath) {
    const self = this;
    const showHiddenFiles = atom.config.get('ftp-remote-edit.tree.showHiddenFiles');

    self.emit('debug', 'ftp:list', remotePath);

    let promise = new Promise((resolve, reject) => {
      try {
        let path = (showHiddenFiles ? '-al ' + remotePath.trim() : remotePath.trim());
        self.client.list(path, function (err, list) {
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

  put(queueItem) {
    const self = this;

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;
    let written = 0;

    self.emit('debug', 'ftp:put', remotePath);

    const timer = setInterval(() => {
      if (!self.client || !self.client._pasvSocket) return;
      queueItem.changeStatus('Transferring');
      written = self.client._pasvSocket.bytesWritten;
      writtena = self.client._socket.bytesWritten;
      queueItem.changeProgress(written);
      self.emit('data', written);
    }, 250);

    let promise = new Promise((resolve, reject) => {
      let buffer = FileSystem.readFileSync(localPath);
      self.client.put(buffer, remotePath, function (err) {
        if (err) {
          if (timer) clearInterval(timer);
          reject(err);
        } else {
          if (timer) clearInterval(timer);
          queueItem.changeProgress(queueItem.info.size);
          resolve(remotePath.trim());
        }
      });
    });

    return promise;
  }

  get(queueItem) {
    const self = this;

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    self.emit('debug', 'ftp:get', remotePath, localPath);

    let promise = new Promise((resolve, reject) => {
      self.client.get(remotePath, function (err, stream) {
        if (err) {
          reject(err);
        } else {
          let file = FileSystem.createWriteStream(localPath, { autoClose: true });

          file.on('open', (err) => {
            queueItem.addStream(file);
            queueItem.changeStatus('Transferring');
          });
          file.on('error', (err) => {
            queueItem.changeStatus('Error');
            reject(err);
          });

          self.client.on('close', function (hadErr) {
            if (hadErr) {
              queueItem.changeStatus('Error');
            } else {
              queueItem.changeStatus('Connection Closed');
            }
            reject(status);
          });
          self.client.on('error', function (err) {
            queueItem.changeStatus('Error');
            reject(err);
          });

          let read = 0;
          stream.on('data', (data) => {
            read += data.length;
            queueItem.changeProgress(read);
            self.emit('data', read);
          });

          stream.once('end', () => {
            queueItem.changeStatus('Finished');
            resolve(localPath.trim());
          });
          stream.pipe(file);
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

      self.client.end();
    });

    return promise;
  }
}
