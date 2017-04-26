'use babel';

// import { View } from 'atom';
// import { CompositeDisposable } from 'atom';

import { File } from 'atom';

var ftpClient = require('ftp');
var FileSystem = require('fs');
const tempDirectory = require('os').tmpdir();

export default class Ftp {
  constructor(connection) {
    const self = this;

    // Create root element
    self.connection = connection;
  }

  // Tear down any state and detach
  destroy() {
    this.connection = null;
  }

  connect(nodeJsFtpClient) {
    nodeJsFtpClient.on('error', (err) => {
      this.showMessage(err.message, 'error');
    });

    nodeJsFtpClient.connect(this.connection);
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

  createDirectory(path) {

    let promise = new Promise((resolve, reject) => {

      var c = new ftpClient();

      c.on('ready', function () {
        c.mkdir(path, function (err) {

          if (err) {
            c.end();
            reject(err);
          } else {
            c.end();
            resolve(path);
          }
        });
      });

      this.connect(c);

    });

    return promise;
  }

  delete(path) {

    let promise = new Promise((resolve, reject) => {

      var c = new ftpClient();

      c.on('ready', function () {
        c.delete(path, function (err) {

          if (err) {
            c.end();
            reject(err);
          } else {
            c.end();
            resolve(path);
          }
        });
      });

      this.connect(c);

    });

    return promise;

  }

  deleteDirectory(path) {

    let promise = new Promise((resolve, reject) => {

      var c = new ftpClient();
      let recursive = true;

      c.on('ready', function () {
        c.rmdir(path, recursive, function (err) {

          if (err) {
            c.end();
            reject(err);
          } else {
            c.end();
            resolve(path);
          }
        });
      });

      this.connect(c);

    });

    return promise;

  }

  rename(oldpath, newPath) {

    let promise = new Promise((resolve, reject) => {

      var c = new ftpClient();
      let recursive = true;

      c.on('ready', function () {
        c.rename(oldpath, newPath, function (err) {

          if (err) {
            c.end();
            reject(err);
          } else {
            c.end();
            resolve(path);
          }
        });
      });

      this.connect(c);

    });

    return promise;

  }

  isFileOnServer(path, callback) {

    let promise = new Promise((resolve, reject) => {

      var c = new ftpClient();

      let directory = path.split('/');
      directory.pop();
      directory = directory.join('/');

      c.on('ready', function () {
        c.list(directory, function (err, list) {

          if (err) {
            atom.showErrorMessage(err.message);
            c.end();
            reject(err);
          } else {
            c.end();

            let file = list.find(function (item) {
              return item.name == path.split('/')
                .slice(-1)[0];
            });

            resolve(file);
          }

        });
      });

      c.on('error', (err) => {
        reject(err);
      });

      this.connect(c);
    });

    return promise;

  }

  writeTextToFile(pathOnServer, pathOnDisk) {

    let promise = new Promise((resolve, reject) => {

      var c = new ftpClient();

      c.on('ready', () => {
        c.get(pathOnServer, (err, stream) => {
          if (err) {
            atom.showErrorMessage(err.message);
          } else {
            stream.once('close', () => { c.end(); });
            stream.once('finish', () => { resolve(true); });
            stream.pipe(FileSystem.createWriteStream(pathOnDisk));
          }
        });
      });

      this.connect(c);
    });

    return promise;
  }

  saveFileToServer(content, serverPath) {

    let promise = new Promise((resolve, reject) => {

      var c = new ftpClient();
      let showMessageFunction = this.showMessage;

      c.on('ready', function () {
        c.put(content, serverPath, function (err, list) {

          if (err) {
            reject(err);
          } else {
            showMessageFunction('File successfully saved to the server.', 'success');
            resolve(true);
          }
          c.end();
        });
      });

      this.connect(c);
    });

    return promise;

  }

  testConnection() {
    return this.loadDirectory('/')
      .then(() => {
        this.showMessage(':)', 'success');
      })
      .catch(() => {});
  }

  loadDirectory(path) {
    let promise = new Promise((resolve, reject) => {

      var c = new ftpClient();
      c.on('ready', function () {
        c.list(path.trim(), function (err, list) {
          if (err) {
            c.end();
            reject(err);
          } else {
            c.end();
            resolve(list);
          }
        });
      });

      c.on('error', (err) => {
        reject(err);
      });

      this.connect(c);
    });

    return promise;

  }

}
