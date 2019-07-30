'use babel';

import { permissionsToRights } from '../helper/helper';

const ftpClient = require("basic-ftp")
const EventEmitter = require('events');
const FileSystem = require('fs-plus');

export default class Ftp extends EventEmitter {

  constructor() {
    super();
  }

  connect(connection) {
    const self = this;
    self.emit('debug', 'ftp:connect');

    self.client = new ftpClient.Client();

    // force PASV mode
    self.client.prepareTransfer = ftpClient.enterPassiveModeIPv4;

    // logging
    self.client.ftp.verbose = true;
    self.client.ftp.log = (message) => {
      if (message.startsWith('<') || message.startsWith('>')) {
        self.emit('log', message.replace(/\'+/g, "").replace(/\\r|\\n/g, " "));
      } else {
        self.emit('debug', 'ftp:debug: ' + message);
      }
    };

    // options
    let options = {
      host: connection.host,
      port: (connection.port) ? connection.port : 21,
      user: connection.user,
      password: connection.password,
    };

    // TLS
    if (connection.secure) {
      options.secure = true;
      options.secureOptions = { 'rejectUnauthorized': false };
    }

    try {
      return self.client.access(options).then(() => {
        self.emit('debug', 'ftp:connect:ready');

        // Not able to get directory listing for regular FTP to an IBM i (or AS/400 or iSeries) #123
        // Force IBM i (or AS/400 or iSeries) returns information
        // for the LIST subcommand in the UNIX style list format.
        return self.client.send('SITE LISTFMT 1', true).then(() => {
          // catch connection timeout - code 421
          self.client.ftp.socket.on("data", (chunk) => {
            const code = parseInt(chunk.trim().substr(0, 3), 10)
            if (code === 421) {
              self.emit('debug', 'ftp:timeout');
              self.emit('log', '> Connection timeout');
              self.emit('timeout', new Error('Connection timeout'));
              self.end();
            }
          });

          return self;
        });
      }).catch((err) => {
        self.emit('debug', 'ftp:connect:close');
        self.emit('log', '> Connection closed');
        self.emit('closed', 'Connection closed');
        throw err;
      });
    } catch (err) {
      self.emit('debug', 'ftp:connect:close');
      self.emit('log', '> Connection closed');
      self.emit('closed', 'Connection closed');
      return Promise.reject(err);
    }
  }

  isConnected() {
    const self = this;

    if (!self.client) return false;

    return self.client.closed === false;
  }

  list(remotePath) {
    const self = this;
    self.emit('debug', 'ftp:list', remotePath);

    const showHiddenFiles = atom.config.get('ftp-remote-edit.tree.showHiddenFiles');
    let path = (showHiddenFiles ? '-al ' + remotePath.trim() : remotePath.trim());

    return self.client.list(path).then((list) => {
      let newlist = list.map((item, index) => {
        let rigths = permissionsToRights(item.permissions.user.toString() + item.permissions.group.toString() + item.permissions.world.toString());
        return {
          type: (item.isFile) ? '-' : (item.isDirectory) ? 'd' : 'l',
          name: item.name,
          size: item.size,
          date: new Date(item.date),
          rights: {
            group: rigths.group,
            other: rigths.other,
            user: rigths.user,
          },
          owner: item.user,
          group: item.group,
          target: (item.link) ? item.link : undefined,
          sticky: false
        };
      });
      return newlist;
    }).catch((err) => {
      throw err;
    });
  }

  mkdir(remotePath) {
    const self = this;
    self.emit('debug', 'ftp:mkdir', remotePath);

    return self.client.protectWhitespace(remotePath).then((validPath) => {
      return self.client.send("MKD " + validPath).then((response) => {
        return remotePath.trim();
      }).catch((err) => {
        throw err;
      });
    }).catch((err) => {
      throw err;
    });
  }

  rmdir(remotePath, recursive) {
    const self = this;
    self.emit('debug', 'ftp:rmdir', remotePath);

    return self.client.removeDir(remotePath).then((response) => {
      return (remotePath.trim());
    }).catch((err) => {
      throw err;
    });
  }

  chmod(remotePath, permissions) {
    const self = this;
    self.emit('debug', 'ftp:chmod', remotePath);

    return self.client.send('SITE CHMOD ' + permissions + ' ' + remotePath);
  }

  put(queueItem) {
    const self = this;
    self.emit('debug', 'ftp:put', remotePath);

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    let file = FileSystem.createReadStream(localPath);
    file.on('open', () => {
      self.emit('debug', 'ftp:put:file.open');
      queueItem.addStream(file);
      queueItem.changeStatus('Transferring');
    });
    file.once('error', (err) => {
      self.emit('debug', 'ftp:put:file.error');
      queueItem.changeStatus('Error');
    });
    file.once('end', () => {
      self.emit('debug', 'ftp:put:file.end');
      queueItem.changeProgress(queueItem.info.size);
    });

    self.client.trackProgress(info => {
      self.emit('debug', 'ftp:put:client.get:progress');
      queueItem.changeProgress(info.bytes);
      self.emit('data', info.bytes);
    });

    return self.client.upload(file, remotePath).then((response) => {
      self.client.trackProgress();
      return remotePath.trim();
    }).catch((err) => {
      self.client.trackProgress();
      file.close();
      throw err;
    });
  }

  get(queueItem) {
    const self = this;
    self.emit('debug', 'ftp:get', remotePath, localPath);

    let remotePath = queueItem.info.remotePath;
    let localPath = queueItem.info.localPath;

    let file = FileSystem.createWriteStream(localPath, { autoClose: true });
    file.once('open', () => {
      self.emit('debug', 'ftp:get:file.open');
      queueItem.addStream(file);
      queueItem.changeStatus('Transferring');
    });
    file.once('error', (err) => {
      self.emit('debug', 'ftp:get:file.error');
      queueItem.changeStatus('Error');
    });
    file.once('finish', () => {
      self.emit('debug', 'ftp:get:file.finish');
      queueItem.changeProgress(queueItem.info.size);
    });

    self.client.trackProgress(info => {
      self.emit('debug', 'ftp:get:client.get:progress');
      queueItem.changeProgress(info.bytes);
      self.emit('data', info.bytes);
    });

    return self.client.download(file, remotePath).then((response) => {
      self.client.trackProgress();
      return localPath.trim();
    }).catch((err) => {
      self.client.trackProgress();
      file.close();
      throw err;
    });
  }

  delete(remotePath) {
    const self = this;
    self.emit('debug', 'ftp:delete', remotePath);

    return self.client.remove(remotePath).then((response) => {
      return (remotePath.trim());
    }).catch((err) => {
      throw err;
    });
  }

  rename(oldRemotePath, newRemotePath) {
    const self = this;
    self.emit('debug', 'ftp:rename', oldRemotePath, newRemotePath);

    return self.client.rename(oldRemotePath, newRemotePath).then((response) => {
      return (newRemotePath.trim());
    }).catch((err) => {
      throw err;
    });
  }

  end() {
    const self = this;
    self.emit('debug', 'ftp:end');

    let promise = new Promise((resolve, reject) => {
      self.emit('log', '> Connection end');
      self.client.close();
      resolve(true);
    });

    return promise;
  }

  abort() {
    const self = this;
    self.emit('debug', 'ftp:abort');

    return self.client.send('ABOR', true);
  }
}
