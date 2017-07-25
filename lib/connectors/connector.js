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

    self.connection = connection;
    self.client = null;
    if(atom.config.get('ftp-remote-edit.debug')){
      self.debug = atom.config.get('ftp-remote-edit.debug');
    }else{
      self.debug = false;
    }

    if (self.connection.sftp === true) {
      self.client = new sftpClient(self.connection);
    } else {
      self.client = new ftpClient(self.connection);
    }
    self.client.debug = self.debug;
    // self.client.connected = false;
  }

  // Tear down any state and detach
  destroy() {
    const self = this;

    return self.client.end();
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
    if (self.debug) console.log('connector:connect');

    // Keep connection alive
    if(self.client.isConnected()){
      return new Promise((resolve, reject) => {
        resolve(self.client);
      });
    }

    // Start new connection
    return self.client.connect(self.connection);
  }

  disconnect(result, error) {
    const self = this;
    if (self.debug) console.log('connector:disconnect');

    // Keep connection alive
    return new Promise((resolve, reject) => {
      if (result) resolve(result);
      if (error) reject(error);
    });

    // return self.client.end()
    //   .then(() => {
    //     return new Promise((resolve, reject) => {
    //       if (result) resolve(result);
    //       if (error) reject(error);
    //     });
    //   })
    //   .catch(() => {
    //     return new Promise((resolve, reject) => {
    //       if (result) resolve(result);
    //       if (error) reject(error);
    //     });
    //   });
  }

  listDirectory(remotePath) {
    const self = this;
    if (self.debug) console.log('connector:listDirectory', remotePath);

    return self.connect()
      .then((Client) => {
        return Client.list(remotePath.trim())
          .then((result) => { return self.disconnect(result); })
          .catch((error) => { return self.disconnect(null, error); });
      })
      .catch((error) => {
        return self.disconnect(null, error);
      });
  }

  createDirectory(remotePath) {
    const self = this;
    if (self.debug) console.log('connector:createDirectory', remotePath);

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
    if (self.debug) console.log('connector:createDirectoryStructure', remotePaths);

    let path = remotePaths.shift();
    let directory = path.split('/');
    directory.pop();
    directory = directory.join('/');
    if(!directory)directory = '/';

    // Walk recursive through directory tree and create non existing directories
    return Client.list(directory)
      .then((list) => {
        let dir = list.find(function (item) {
          return item.name == path.split('/')
            .slice(-1)[0];
        });

        if (dir) {
          if (remotePaths.length > 0) {
            return self.createDirectoryStructure(Client, remotePaths)
              .then(() => {
                return new Promise((resolve, reject) => {
                  resolve(path.trim());
                });
              });
          } else {
            return new Promise((resolve, reject) => {
              resolve(path.trim());
            });
          }
        } else {
          return Client.mkdir(path.trim())
            .then(() => {
              if (remotePaths.length > 0) {
                return self.createDirectoryStructure(Client, remotePaths)
                  .then(() => {
                    return new Promise((resolve, reject) => {
                      resolve(path.trim());
                    });
                  });
              } else {
                return new Promise((resolve, reject) => {
                  resolve(path.trim());
                });
              }
            });
        }
      });
  }

  deleteDirectory(remotePath, recursive) {
    const self = this;
    if (self.debug) console.log('connector:deleteDirectory', remotePath);

    return self.connect()
      .then((Client) => {
        return Client.rmdir(remotePath.trim(), true)
          .then((result) => { return self.disconnect(result); })
          .catch((error) => { return self.disconnect(null, error); });
      });
  }

  existsDirectory(remotePath) {
    const self = this;
    if (self.debug) console.log('connector:existsDirectory', remotePath);

    if (!remotePath || remotePath == '/') {
      return new Promise((resolve, reject) => {
        resolve(remotePath);
      });
    }

    return self.connect()
      .then((Client) => {
        let directory = remotePath.split('/');
        directory.pop();
        directory = directory.join('/');

        return Client.list(directory)
          .then((list) => {
            let dir = list.find(function (item) {
              return item.name == remotePath.split('/')
                .slice(-1)[0];
            });
            if (dir) {
              return self.disconnect(remotePath);
            }
            return self.disconnect(null, { message: 'Directory not exists.' });
          })
          .catch((error) => { return self.disconnect(null, error); });
      });
  }

  uploadFile(content, remotePath, localPath) {
    const self = this;
    if (self.debug) console.log('connector:uploadFile', remotePath, localPath);

    let arrPath = remotePath.split('/');
    arrPath.pop();

    return self.createDirectory(arrPath.join('/'))
      .then(() => {
        return self.connect()
          .then((Client) => {
            return Client.put(content, remotePath, localPath)
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
      })
      .catch((err) => {
        console.log('sss', err);
        //return self.disconnect(null, err);
      });
  }

  downloadFile(remotePath, localPath) {
    const self = this;
    if (self.debug) console.log('connector:downloadFile', remotePath, localPath);

    return self.connect()
      .then((Client) => {
        return Client.get(remotePath, localPath)
          .then((stream) => {

            stream.once('close', () => {
              return self.disconnect(true);
            });
            stream.once('finish', () => {
              return self.disconnect(localPath.trim());
            });

            let file = FileSystem.createWriteStream(localPath, { autoClose: true });
            file.on('error', (err) => {
              return self.disconnect(null, err);
            });

            stream.pipe(file);
          });
      });
  }

  deleteFile(remotePath) {
    const self = this;
    if (self.debug) console.log('connector:deleteFile', remotePath);

    return self.connect()
      .then((Client) => {
        return Client.delete(remotePath.trim())
          .then(() => {
            return self.disconnect(remotePath.trim());
          })
          .catch((result) => { return self.disconnect(result); });
      });
  }

  existsFile(remotePath) {
    const self = this;
    if (self.debug) console.log('connector:existsFile', remotePath);

    return self.connect()
      .then((Client) => {
        let directory = remotePath.split('/');
        directory.pop();
        directory = directory.join('/');

        return Client.list(directory)
          .then((list) => {
            let file = list.find(function (item) {
              return item.name == remotePath.split('/')
                .slice(-1)[0];
            });
            if (file) {
              return self.disconnect(remotePath);
            }
            return self.disconnect(null, { message: 'File not exists.' });
          })
          .catch((error) => { return self.disconnect(null, error); });
      });
  }

  rename(oldRemotePath, newRemotePath) {
    const self = this;
    if (self.debug) console.log('connector:rename', oldRemotePath, newRemotePath);

    return self.connect()
      .then((Client) => {
        return Client.rename(oldRemotePath.trim(), newRemotePath.trim())
          .then(() => {
            return self.disconnect(newRemotePath.trim());
          })
          .catch((err) => { return self.disconnect(null, err); });
      });
  }
}
