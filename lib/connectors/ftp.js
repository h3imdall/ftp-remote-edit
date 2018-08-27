'use babel';

var ftpClient = require('@icetee/ftp');
const EventEmitter = require('events');
const FileSystem = require('fs-plus');
const progress = require('progress-stream');

export default class Ftp extends EventEmitter {

  constructor(connection) {
    super();
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

      self.client.on('close', (hadError) => {
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

  chmod(remotePath, permissions) {
    const self = this;

    self.emit('debug', 'ftp:chmod', remotePath);

    let promise = new Promise((resolve, reject) => {
      self.client.site('CHMOD ' + permissions + ' ' + remotePath, function (err, responseText, responseCode) {
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

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    self.emit('debug', 'ftp:put', remotePath);

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

      self.client.put(input.pipe(str), remotePath, function (err) {
        if (err) {
          reject(err);
        } else {
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

      self.client.get(remotePath, function (err, stream) {
        if (err) {
          reject(err);
        } else {
          let file = FileSystem.createWriteStream(localPath, { autoClose: true });

          file.on('open', () => {
            queueItem.addStream(file);
            queueItem.changeStatus('Transferring');
          });
          file.once('error', (err) => {
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

      self.client.on('close', (hadError) => {
        self.emit('debug', 'ftp:end:close');
        self.connected = false;
        resolve(true);
      });

      self.client.end();
    });

    return promise;
  }
}
