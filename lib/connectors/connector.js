'use babel';

import { File } from 'atom';

var ftpClient = require('./ftp');
var sftpClient = require('./sftp');
const EventEmitter = require('events');
const tempDirectory = require('os').tmpdir();
const Queue = require('./../helper/queue.js');

export default class Connector extends EventEmitter {

  constructor(connection) {
    super();
    const self = this;

    self.connection = connection;
    self.client = null;

    if (self.connection.sftp === true) {
      self.client = new sftpClient();
    } else {
      self.client = new ftpClient();
    }

    // Events
    self.client.on('debug', function (msg) {
      self.emit('debug', msg);
    });
    self.client.on('log', function (msg) {
      self.emit('log', msg);
    });
  }

  // Tear down any state and detach
  destroy() {
    const self = this;

    return self.client.end();
  }

  showMessage(msg, type = 'info') {
    if (msg instanceof Error) {
      msg = msg.message;
    }

    if (typeof msg !== 'string') {
      msg = 'Unknown error';
    }

    if (type === 'success') {
      atom.notifications.addSuccess('Ftp-Remote-Edit', {
        description: msg
      });
    } else if (type === 'info') {
      atom.notifications.addInfo('Ftp-Remote-Edit', {
        description: msg
      });
    } else {
      atom.notifications.addError('Ftp-Remote-Edit', {
        description: msg,
      });
    }
  }

  connect() {
    const self = this;
    self.emit('debug', 'connector:connect');

    // Keep connection alive
    if (self.client.isConnected()) {
      return new Promise((resolve, reject) => {
        resolve(self.client);
      });
    }

    try {
      // Start new connection
      return self.client.connect(self.connection);
    } catch (err) {
      console.log(err)
      return self.disconnect(null, err);
    }
  }

  disconnect(result, error) {
    const self = this;
    self.emit('debug', 'connector:disconnect');

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
    self.emit('debug', 'connector:listDirectory', remotePath);

    return self.connect().then((Client) => {
      return Client.list(remotePath.trim()).then((result) => {
        return self.disconnect(result);
      }).catch((error) => { return self.disconnect(null, error); });
    }).catch((error) => {
      return self.disconnect(null, error);
    });
  }

  createDirectory(remotePath) {
    const self = this;
    self.emit('debug', 'connector:createDirectory', remotePath);

    // Check directory already exists
    return self.existsDirectory(remotePath.trim()).then(() => {
      // Directory already exists
      // Nothing to do
      return new Promise((resolve, reject) => {
        resolve(remotePath.trim());
      });
    }).catch(() => {
      // Directory not exists and must be created
      return self.connect().then((Client) => {

        let paths = [];
        remotePath.split('/').reduce((path, dir) => {
          path += '/' + dir.trim();
          paths.push(path);
          return path;
        });

        // Walk recursive through directory tree and create non existing directories
        return self.createDirectoryStructure(Client, paths).then(() => {
          return self.disconnect(remotePath.trim());
        }).catch((err) => {
          return self.disconnect(null, err);
        });
      }).catch((err) => {
        return self.disconnect(null, err);
      });
    });
  }

  createDirectoryStructure(Client, remotePaths) {
    const self = this;
    self.emit('debug', 'connector:createDirectoryStructure', remotePaths);

    let path = remotePaths.shift();
    let directory = path.split('/');
    directory.pop();
    directory = directory.join('/');
    if (!directory) directory = '/';

    // Walk recursive through directory tree and create non existing directories
    return Client.list(directory).then((list) => {
      let dir = list.find(function (item) {
        return item.name == path.split('/').slice(-1)[0];
      });

      if (dir) {
        if (remotePaths.length > 0) {
          return self.createDirectoryStructure(Client, remotePaths).then(() => {
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
        return Client.mkdir(path.trim()).then(() => {
          if (remotePaths.length > 0) {
            return self.createDirectoryStructure(Client, remotePaths).then(() => {
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
    self.emit('debug', 'connector:deleteDirectory', remotePath);

    return self.connect().then((Client) => {
      return Client.rmdir(remotePath.trim(), true).then((result) => {
        return self.disconnect(result);
      }).catch((error) => { return self.disconnect(null, error); });
    });
  }

  existsDirectory(remotePath) {
    const self = this;
    self.emit('debug', 'connector:existsDirectory', remotePath);

    if (!remotePath || remotePath == '/') {
      return new Promise((resolve, reject) => {
        resolve(remotePath);
      });
    }

    return self.connect().then((Client) => {
      let directory = remotePath.split('/');
      directory.pop();
      directory = directory.join('/');

      return Client.list(directory).then((list) => {
        let dir = list.find(function (item) {
          return item.name == remotePath.split('/').slice(-1)[0];
        });
        if (dir) {
          return self.disconnect(remotePath);
        }
        return self.disconnect(null, { message: 'Directory not exists.' });
      }).catch((error) => { return self.disconnect(null, error); });
    });
  }

  chmodDirectory(remotePath, permissions) {
    const self = this;
    self.emit('debug', 'connector:chmodDirectory', remotePath + ' ' + permissions);

    return self.connect().then((Client) => {
      return Client.chmod(remotePath, permissions).then((responseText) => {
        return self.disconnect(responseText);
      }).catch((error) => { return self.disconnect(null, error); });
    });
  }

  uploadFile(queueItem) {
    const self = this;
    self.emit('debug', 'connector:uploadFile', queueItem.info.remotePath, queueItem.info.localPath);

    let arrPath = queueItem.info.remotePath.split('/');
    arrPath.pop();

    return self.createDirectory(arrPath.join('/')).then(() => {
      return self.connect().then((Client) => {
        return Client.put(queueItem).then((remotePath) => {
          queueItem.changeStatus('Finished');
          return self.disconnect(remotePath);
        }).catch((err) => {
          queueItem.changeStatus('Error');
          return self.disconnect(null, err);
        });
      }).catch((err) => {
        queueItem.changeStatus('Error');
        return self.disconnect(null, err);
      });
    }).catch((err) => {
      queueItem.changeStatus('Error');
      return self.disconnect(null, err);
    });
  }

  downloadFile(queueItem) {
    const self = this;
    self.emit('debug', 'connector:downloadFile', queueItem.info.remotePath, queueItem.info.localPath);

    return self.connect().then((Client) => {
      return Client.get(queueItem).then((localPath) => {
        queueItem.changeStatus('Finished');
        return self.disconnect(localPath);
      }).catch((error) => {
        queueItem.changeStatus('Error');
        return self.disconnect(null, error);
      });
    }).catch((error) => {
      queueItem.changeStatus('Error');
      return self.disconnect(null, error);
    });
  }

  deleteFile(remotePath) {
    const self = this;
    self.emit('debug', 'connector:deleteFile', remotePath);

    return self.connect().then((Client) => {
      return Client.delete(remotePath.trim()).then(() => {
        return self.disconnect(remotePath.trim());
      }).catch((result) => { return self.disconnect(result); });
    });
  }

  existsFile(remotePath) {
    const self = this;
    self.emit('debug', 'connector:existsFile', remotePath);

    return self.connect().then((Client) => {
      let directory = remotePath.split('/');
      directory.pop();
      directory = directory.join('/');

      return Client.list(directory).then((list) => {
        let file = list.find(function (item) {
          return item.name == remotePath.split('/').slice(-1)[0];
        });
        if (file) {
          return self.disconnect(remotePath);
        }
        return self.disconnect(null, { message: 'File not exists.' });
      }).catch((error) => { return self.disconnect(null, error); });
    });
  }

  chmodFile(remotePath, permissions) {
    const self = this;
    self.emit('debug', 'connector:chmodFile', remotePath + ' ' + permissions);

    return self.connect().then((Client) => {
      return Client.chmod(remotePath, permissions).then((responseText) => {
        return self.disconnect(responseText);
      }).catch((error) => { return self.disconnect(null, error); });
    });
  }

  rename(oldRemotePath, newRemotePath) {
    const self = this;
    self.emit('debug', 'connector:rename', oldRemotePath, newRemotePath);

    return self.connect().then((Client) => {
      return Client.rename(oldRemotePath.trim(), newRemotePath.trim()).then(() => {
        return self.disconnect(newRemotePath.trim());
      }).catch((err) => { return self.disconnect(null, err); });
    });
  }
}
