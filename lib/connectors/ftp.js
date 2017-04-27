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
        dismissable: true
      });
    }
  }

  connect() {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      var nodeJsFtpClient = new ftpClient();

      nodeJsFtpClient.on('ready', function () {
        resolve(nodeJsFtpClient);
      });

      nodeJsFtpClient.on('error', (err) => {
        self.showMessage(err.message, 'error');
        reject(err);
      });

      nodeJsFtpClient.connect(self.connection);
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
        .then((nodeJsFtpClient) => {
          nodeJsFtpClient.list(remotePath.trim(), function (err, list) {
            if (err) {
              reject(err);
            } else {
              resolve(list);
            }
            nodeJsFtpClient.end();
          });
        })
        .catch((err) => {
          reject(err);
        });
    });

    return promise;
  }

  createDirectory(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((nodeJsFtpClient) => {
          nodeJsFtpClient.mkdir(remotePath.trim(), function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(remotePath.trim());
            }
            nodeJsFtpClient.end();
          });
        })
        .catch((err) => {
          reject(err);
        });
    });

    return promise;
  }

  deleteDirectory(remotePath, recursive) {
    const self = this;

    if (recursive === null) recursive = true;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((nodeJsFtpClient) => {
          nodeJsFtpClient.rmdir(remotePath.trim(), recursive, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(remotePath.trim());
            }
            nodeJsFtpClient.end();
          });
        })
        .catch((err) => {
          reject(err);
        });
    });

    return promise;
  }

  uploadFile(content, remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((nodeJsFtpClient) => {
          nodeJsFtpClient.put(content, remotePath, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(remotePath.trim());
            }
            nodeJsFtpClient.end();
          });
        })
        .catch((err) => {
          reject(err);
        });
    });

    return promise;
  }

  downloadFile(remotePath, localPath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((nodeJsFtpClient) => {
          nodeJsFtpClient.get(remotePath, (err, stream) => {
            if (err) {
              nodeJsFtpClient.end();
              reject(err);
            } else {
              stream.once('close', () => {
                nodeJsFtpClient.end();
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
        });
    });

    return promise;
  }

  deleteFile(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((nodeJsFtpClient) => {
          nodeJsFtpClient.delete(remotePath.trim(), function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(remotePath.trim());
            }
            nodeJsFtpClient.end();
          });
        })
        .catch((err) => {
          reject(err);
        });
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
          });
      })
      .catch((err) => {
        reject(err);
      });

    return promise;
  }

  rename(oldRemotePath, newRemotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((nodeJsFtpClient) => {
          nodeJsFtpClient.rename(oldRemotePath.trim(), newRemotePath.trim(), function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(newRemotePath.trim());
            }
            nodeJsFtpClient.end();
          });
        })
        .catch((err) => {
          reject(err);
        });
    });

    return promise;
  }
}
