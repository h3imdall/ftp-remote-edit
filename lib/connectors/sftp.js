'use babel';

var sftpClient = require('./ssh2-sftp-client.js');
const FileSystem = require('fs-plus');
const EventEmitter = require('events');

export default class Sftp extends EventEmitter {

  constructor(connection) {
    super();
    const self = this;

    self.setMaxListeners(100);
  }

  connect(connection) {
    const self = this;
    self.emit('debug', 'sftp:connect');

    self.client = new sftpClient();

    self.client.on('ready', function () {
      self.emit('debug', 'sftp:connect:ready');
      this.emit('connected');
    });

    self.client.on('error', (err) => {
      self.emit('debug', 'sftp:connect:error', err);
      // self.emit('error', err);
      reject(err);
    });

    self.client.on('end', () => {
      self.emit('debug', 'sftp:connect:end');
      self.emit('ended', 'Connection end');
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

    return self.client.connect(connection)
      .then(() => {
        self.connected = true;
        return new Promise((resolve, reject) => {
          resolve(self);
        });
      })
      .catch((err) => {
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

    return self.client.list(remotePath);
  }

  mkdir(remotePath) {
    const self = this;
    self.emit('debug', 'sftp:mkdir', remotePath);

    return self.client.mkdir(remotePath)
      .then(() => {
        return new Promise((resolve, reject) => {
          resolve(remotePath.trim());
        });
      });
  }

  rmdir(remotePath, recursive) {
    const self = this;
    self.emit('debug', 'sftp:rmdir', remotePath);

    return self.client.rmdir(remotePath, recursive)
      .then(() => {
        return new Promise((resolve, reject) => {
          resolve(remotePath.trim());
        });
      });
  }

  put(content, queueItem) {
    const self = this;

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    self.emit('debug', 'sftp:put', remotePath);

    let promise = new Promise((resolve, reject) => {
      let buffer = Buffer.from(content);

      let read = 0;
      self.client.on('data', (data) => {
        read += data.length;
        queueItem.changeProgress(read);
        self.emit('data', read);
      });

      return self.client.put(buffer, remotePath)
        .then(() => {
          queueItem.changeProgress(queueItem.info.size);
          resolve(localPath.trim());
        })
        .catch((err) => {
          queueItem.changeStatus('Error');
          reject(err);
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
      return self.client.get(remotePath, null, null)
        .then((stream) => {
          let file = FileSystem.createWriteStream(localPath, { autoClose: true });

          file.on('open', (err) => {
            queueItem.addStream(file);
            queueItem.changeStatus('Transferring');
          });
          file.on('error', (err) => {
            queueItem.changeStatus('Error');
            reject(err);
          });

          self.on('closed', function (status) {
            queueItem.changeStatus('Error');
            reject(status);
          });
          self.on('error', function (err) {
            queueItem.changeStatus('Error');
            reject(status);
          });

          let read = 0;
          stream.on('data', (data) => {
            read += data.length;
            queueItem.changeProgress(read);
            self.emit('data', read);
          });

          stream.once('end', () => {
            resolve(localPath.trim());
          });
          stream.pipe(file);
        })
        .catch((err) => {
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
