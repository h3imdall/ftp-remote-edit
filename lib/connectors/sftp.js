'use babel';

var sftpClient = require('ssh2-sftp-client');
const FileSystem = require('fs');
const EventEmitter = require('events');

export default class Sftp extends EventEmitter {

  connect(connection) {
    const self = this;
    self.emit('debug', 'sftp:connect');

    self.client = new sftpClient();

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

  put(content, remotePath, pathOnDisk) {
    const self = this;
    self.emit('debug', 'sftp:put', remotePath);

    if (pathOnDisk === null) {
      return self.client.put(Buffer.from([]), remotePath);
    } else {
      return self.client.put(pathOnDisk, remotePath);
    }
  }

  get(remotePath, localPath) {
    const self = this;
    self.emit('debug', 'sftp:get', remotePath, localPath);

    return self.client.get(remotePath, null, null);
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
