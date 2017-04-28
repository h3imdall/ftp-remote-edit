'use babel';

import { File } from 'atom';
var ftpClient = require('ftp');
var FileSystem = require('fs');

const tempDirectory = require('os')
  .tmpdir();

export default class Ftp {

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

    let promise = new Promise((resolve, reject) => {
      // if (self.conected) {
      //   return self.client;
      // }

      var Client = new ftpClient();
      Client.on('ready', function () {
        self.conected = true;
        self.client = Client;
        resolve(Client);
      });

      Client.on('error', (err) => {
        self.conected = false;
        self.client = null;
        reject(err);
      });

      Client.on('end', (err) => {
        self.conected = false;
        self.client = null;
        resolve(null);
      });

      Client.on('close', (err) => {
        self.conected = false;
        self.client = null;
        resolve(null);
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
        });
    });

    return promise;
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
          resolve(remotePath.trim());
        })
        .catch(() => {
          // Directory not exists and must be created
          self.existsDirectory(arrPath.join('/'))
            .then(() => {
              // Parent directoy structure exists
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
                });
            })
            .catch(() => {
              // Parent directoy structure not exists and must be created
              self.connect()
                .then((Client) => {
                  remotePath.split('/')
                    .reduce((path, dir) => {
                      path += '/' + dir.trim();

                      // Walk recursive through directory tree and create non existing directories
                      Client.list(path.trim(), function (err, list) {
                        if (err) {
                          Client.mkdir(path.trim(), function (err) {
                            if (err) {
                              reject(err);
                            } else {
                              resolve(path.trim());
                            }
                          });
                        }
                      })
                      return path;
                    });
                })
                .catch((err) => {
                  reject(err);
                });
            })
        });
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
        });
    });

    return promise;
  }

  existsDirectory(remotePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.connect()
        .then((Client) => {
          if (!remotePath || remotePath == '/') {
            Client.list('/', function (err, list) {
              if (err) {
                reject(err);
              } else {
                resolve(remotePath.trim());
              }
              Client.end();
            });
          } else {
            let directory = remotePath.split('/');
            directory.pop();
            directory = directory.join('/');

            Client.list(directory, function (err, list) {
              if (err) {
                reject(err);
              } else {
                let dir = list.find(function (item) {
                  return item.name == remotePath.split('/')
                    .slice(-1)[0];
                });
                if (dir) {
                  resolve(dir);
                } else {
                  reject('Directory not exists.');
                }
                resolve(dir);
              }
              Client.end();
            });
          }
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
      let arrPath = remotePath.split('/');
      arrPath.pop();

      self.createDirectory(arrPath.join('/'))
        .then(() => {
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
        });
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
            if (file) {
              resolve(file);
            } else {
              reject('File not exists.');
            }
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
        });
    });

    return promise;
  }
}
