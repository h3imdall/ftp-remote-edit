'use babel';

import { File } from 'atom';
var ftpClient = require('ftp');
var FileSystem = require('fs');

const tempDirectory = require('os').tmpdir();

export default class Ftp {

  constructor(connection) {
    const self = this;

    self.connection = connection;
  }

  // Tear down any state and detach
  destroy() {
    const self = this;

    this.connection = null;
  }

  showMessage(message, type = 'info') {
    if (type === 'success') {
      atom.notifications.addSuccess('Ftp-Remote-Edit', {
        description: message
      });
    } else if (type === 'info') {
      atom.notifications.addInfo('Ftp-Remote-Edit', {
        description: message
      });
    } else {
      atom.notifications.addError('Ftp-Remote-Edit', {
        description: message,
      });
    }
  }

  connect() {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      var Client = new ftpClient();

      Client.on('ready', function () {
        resolve(Client);
      });

      Client.on('error', (err) => {
        reject(err);
      });

      Client.connect(self.connection);
    });

    return promise;
  }

  testConnection() {
    const self = this;

    return self.listDirectory('/')
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  }

  listDirectory(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          Client.list(remotePath.trim(), function (err, list) {
            if (err) {
              reject(err);
            } else {
              resolve(list);
            }
            Client.end();
          });
        })
        .catch((err) => {
          reject(err);
        })
        .done();
    });

    return promise;
  }

  createDirectory(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          Client.mkdir(remotePath.trim(), function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(remotePath.trim());
            }
            Client.end();
          });
        })
        .catch((err) => {
          reject(err);
        })
        .done();
    });

    return promise;
  }

  deleteDirectory(remotePath, recursive) {
    const self = this;

    if (recursive === null) recursive = true;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          Client.rmdir(remotePath.trim(), recursive, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(remotePath.trim());
            }
            Client.end();
          });
        })
        .catch((err) => {
          reject(err);
        })
        .done();
    });

    return promise;
  }

  existsDirectory(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
        let directory = remotePath.split('/');
        directory.pop();
        directory = directory.join('/');

        self.listDirectory(directory)
          .then((list) => {
            let file = list.find(function (item) {
              return item.name == remotePath.split('/')
                .slice(-1)[0];
            });
            resolve(file);
          })
          .catch(() => {
            reject(err);
          })
          .done();
      })
      .catch((err) => {
        reject(err);
      })
      .done();

    return promise;
  }

  uploadFile(content, remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          Client.put(content, remotePath, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(remotePath.trim());
            }
            Client.end();
          });
        })
        .catch((err) => {
          reject(err);
        })
        .done();
    });

    return promise;
  }

  downloadFile(remotePath, localPath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          Client.get(remotePath, (err, stream) => {
            if (err) {
              Client.end();
              reject(err);
            } else {
              stream.once('close', () => {
                Client.end();
              });
              stream.once('finish', () => {
                resolve(localPath.trim());
              });

              let file = FileSystem.createWriteStream(localPath, { autoClose: true });
              file.on('error', (err) => {
                reject(err);
              });

              stream.pipe(file);
            }
          });
        })
        .catch((err) => {
          reject(err);
        })
        .done();
    });

    return promise;
  }

  deleteFile(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          Client.delete(remotePath.trim(), function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(remotePath.trim());
            }
            Client.end();
          });
        })
        .catch((err) => {
          reject(err);
        })
        .done();
    });

    return promise;
  }

  existsFile(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
        let directory = remotePath.split('/');
        directory.pop();
        directory = directory.join('/');

        self.listDirectory(directory)
          .then((list) => {
            let file = list.find(function (item) {
              return item.name == remotePath.split('/')
                .slice(-1)[0];
            });
            resolve(file);
          })
          .catch(() => {
            reject(err);
          })
          .done();
      })
      .catch((err) => {
        reject(err);
      })
      .done();

    return promise;
  }

  rename(oldRemotePath, newRemotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          Client.rename(oldRemotePath.trim(), newRemotePath.trim(), function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(newRemotePath.trim());
            }
            Client.end();
          });
        })
        .catch((err) => {
          reject(err);
        })
        .done();
    });

    return promise;
  }
}
