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

    if(this.connection.sftp === true) {
      this.client = new sftpClient(this.connection);
    } else {
      this.client = new ftpClient(this.connection);
    }
  
    return this.client.connect(this.connection);
  }

  disconnect(result) {
    return new Promise((resolve, reject) => {
      this.client.end();
      resolve(result);
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
          .then((result) => { return this.disconnect(result); })
          .catch((result) => { return this.disconnect(result); });
      });
  }

  createDirectory(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      let arrPath = remotePath.split('/');
      let directory = arrPath.pop();

      // Check directory already exists
      self.existsDirectory(remotePath.trim())
        .then(() => {
          // Directory already exists
          // Nothing to do
          this.disconnect();
          resolve(remotePath.trim());
        })
        .catch(() => {
          // Directory not exists and must be created
          self.existsDirectory(arrPath.join('/'))
            .then(() => {
              // Parent directoy structure exists
              self.connect()
                .then((Client) => {
                  Client.mkdir(remotePath.trim())
                    .then(() => {
                      this.disconnect();
                      resolve(remotePath.trim());
                    })
                    .catch((err) => {
                      this.disconnect();
                      reject(err);
                    });
                    
                })
                .catch((err) => {
                  reject(err);
                });
            })
            .catch(() => {
              // Parent directoy structure not exists and must be created
              self.connect()
                .then((Client) => {
                  remotePath.split('/').reduce((path, dir) => {
                    path += '/' + dir.trim();

                    // Walk recursive through directory tree and create non existing directories
                    Client.list(path.trim())
                      .catch(() => {
                        Client.mkdir(path.trim())
                          .then(() => {
                            this.disconnect();
                            resolve(path.trim());
                          })
                          .catch((err) => {
                            this.disconnect();
                            reject(err);
                          });
                      });
                    return path;
                    });
                })
                .catch((err) => {
                  this.clien.end();
                  reject(err);
                });
            })
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
          .then((result) => { return this.disconnect(result); })
          .catch((result) => { return this.disconnect(result); });
      });
  }

  existsDirectory(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          if (!remotePath || remotePath == '/') {
            this.disconnect();
            resolve(remotePath);
          } else {
            let directory = remotePath.split('/');
            directory.pop();
            directory = directory.join('/');

            Client.list(directory)
              .then((list) => {
                let dir = list.find(function (item) {
                  return item.name == remotePath.split('/').slice(-1)[0];
                });
                if (dir) {
                  this.disconnect();
                  resolve(dir);
                } else {
                  this.disconnect();
                  reject('Directory not exists.');
                }
              })
              .catch((err) => {
                this.disconnect();
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
                this.disconnect();
                resolve(remotePath.trim());
              })
              .catch((err) => {
                this.disconnect();
                reject(err);
              });
            })
            .catch((err) => {
              this.disconnect();
              reject(err);
            });
        })
        .catch((err) => {
          this.disconnect();
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
            this.disconnect();
            return remotePath.trim();
          })
          .catch((result) => { return this.disconnect(result); });
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
            this.disconnect();
            reject(err);
          });
      })
      .catch((err) => {
        this.disconnect();
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
            this.disconnect();
            return newRemotePath.trim(); 
          })
          .catch((err) => { 
            this.disconnect();
            return err;
          });
      });
  }
}
