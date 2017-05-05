'use babel';

import { File } from 'atom';
var ftpClient = require('./ftp');
var sftpClient = require('./sftp');
var FileSystem = require('fs');

const tempDirectory = require('os')
  .tmpdir();

export default class Connector {

  constructor(connection) {
    const self = this;

    self.conected = false;
    self.connection = connection;
    self.client = null;
  }

  // Tear down any state and detach
  destroy() {
    const self = this;

    self.conected = false;
    self.connection = null;
    self.client = null;
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

    if (self.connection.sftp === true) {
      self.client = new sftpClient(self.connection);
    } else {
      self.client = new ftpClient(self.connection);
    }

    return self.client.connect(self.connection);
  }

  disconnect(result, error) {
    const self = this;

    return new Promise((resolve, reject) => {
      self.client.end();

      if (result) resolve(result);
      if (error) reject(error);
    });
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

    return self.connect()
      .then((Client) => {
        return Client.list(remotePath.trim())
          .then((result) => { return self.disconnect(result); })
          .catch((error) => { return self.disconnect(null, error); });
      });
  }

  createDirectory(remotePath) {
    const self = this;

    // Check directory already exists
    return self.existsDirectory(remotePath.trim())
      .then(() => {
        // Directory already exists
        // Nothing to do
        return new Promise((resolve, reject) => {
          resolve(remotePath.trim());
        });
      })
      .catch(() => {
        // Directory not exists and must be created
        return self.connect()
          .then((Client) => {

            let paths = [];
            remotePath.split('/')
              .reduce((path, dir) => {
                path += '/' + dir.trim();
                paths.push(path);

                return path;
              });

            // Walk recursive through directory tree and create non existing directories
            return self.createDirectoryStructure(Client, paths)
              .then(() => {
                return self.disconnect(remotePath.trim());
              })
              .catch((err) => {
                return self.disconnect(null, err);
              });
          })
          .catch((err) => {
            return self.disconnect(null, err);
          });
      });
  }

  createDirectoryStructure(Client, remotePaths) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      let path = remotePaths.shift();

      // Walk recursive through directory tree and create non existing directories
      Client.list(path.trim())
        .then(() => {
          if (remotePaths.length > 0) {
            self.createDirectoryStructure(Client, remotePaths)
              .then(() => {
                resolve(path.trim());
              })
              .catch((err) => {
                reject(err);
              });

          } else {
            resolve(path.trim());
          }
        })
        .catch(() => {
          Client.mkdir(path.trim())
            .then(() => {
              if (remotePaths.length > 0) {
                self.createDirectoryStructure(Client, remotePaths)
                  .then(() => {
                    resolve(path.trim());
                  })
                  .catch((err) => {
                    reject(err);
                  });

              } else {
                resolve(path.trim());
              }
            })
            .catch((err) => {
              reject(err);
            });
        });
    });

    return promise;
  }

  deleteDirectory(remotePath, recursive) {
    const self = this;

    recursive = true;

    return self.connect()
      .then((Client) => {
        return Client.rmdir(remotePath.trim(), recursive)
          .then((result) => { return self.disconnect(result); })
          .catch((error) => { return self.disconnect(null, error); });
      });
  }

  existsDirectory(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          if (!remotePath || remotePath == '/') {
            self.disconnect();
            resolve(remotePath);
          } else {
            let directory = remotePath.split('/');
            directory.pop();
            directory = directory.join('/');

            Client.list(directory)
              .then((list) => {
                let dir = list.find(function (item) {
                  return item.name == remotePath.split('/')
                    .slice(-1)[0];
                });
                if (dir) {
                  self.disconnect();
                  resolve(dir);
                } else {
                  self.disconnect();
                  reject('Directory not exists.');
                }
              })
              .catch((err) => {
                self.disconnect();
                reject(err);
              });
          }
        })
        .catch((err) => {
          reject(err);
        });
    });

    return promise;
  }

  uploadFile(content, remotePath, pathOnDisk) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      let arrPath = remotePath.split('/');
      arrPath.pop();

      self.createDirectory(arrPath.join('/'))
        .then(() => {
          self.connect()
            .then((Client) => {
              return Client.put(content, remotePath, pathOnDisk)
                .then(() => {
                  self.disconnect();
                  resolve(remotePath.trim());
                })
                .catch((err) => {
                  self.disconnect();
                  reject(err);
                });
            })
            .catch((err) => {
              self.disconnect();
              reject(err);
            });
        })
        .catch((err) => {
          self.disconnect();
          reject(err);
        });
    });

    return promise;
  }

  downloadFile(remotePath, localPath) {
    const self = this;

    return self.connect()
      .then((Client) => {
        return Client.get(remotePath)
          .then((stream) => {

            stream.once('close', () => {
              self.disconnect();
            });
            stream.once('finish', () => {
              return localPath.trim();
            });

            let file = FileSystem.createWriteStream(localPath, { autoClose: true });
            file.on('error', (err) => {
              return err;
            });

            stream.pipe(file);
          });
      });
  }

  deleteFile(remotePath) {
    const self = this;

    return self.connect()
      .then((Client) => {
        return Client.delete(remotePath.trim())
          .then(() => {
            self.disconnect();
            return remotePath.trim();
          })
          .catch((result) => { return self.disconnect(result); });
      });
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
            if (file) {
              resolve(file);
            } else {
              reject('File not exists.');
            }
          })
          .catch(() => {
            self.disconnect();
            reject(err);
          });
      })
      .catch((err) => {
        self.disconnect();
        reject(err);
      });

    return promise;
  }

  rename(oldRemotePath, newRemotePath) {
    const self = this;

    return self.connect()
      .then((Client) => {
        Client.rename(oldRemotePath.trim(), newRemotePath.trim())
          .then(() => {
            self.disconnect();
            return newRemotePath.trim();
          })
          .catch((err) => {
            self.disconnect();
            return err;
          });
      });
  }
}
