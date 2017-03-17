'use babel';


import Ftp from './Ftp.js';
var sftpClient = require('ssh2-sftp-client');
var FileSystem = require('fs');

export default class Sftp extends Ftp {

  constructor(connection) {

    super(connection);

    this.connection = connection;
    this.sftpClient = new sftpClient();
  }


  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }


  connect () {

        let description = `The following connection could be incorrect. 
* Host: ${this.connection.host}
* User: ${this.connection.user}
* Password: ${this.connection.password}
* Port: ${this.connection.port}
* Use sftp(ssh): ${this.connection.sftp}`;

    // promise is running
    if(this.promise !== null && this.promise !== undefined) {
        this.showMessage('The is a running operation.', '', 'info');
        return Promise.reject();
    } else {
        let promise = this.sftpClient.connect(this.connection)
        .then(() => {
            this.promise = null;
        })
        .catch((err) => {
            this.promise = null;
            this.showMessage(err.message, description, 'error');
        });
        this.promise = promise;
        return promise;
    }

  }

  createDirectory (path) {

    return this.connect().then(() => {
        return this.sftpClient.mkdir(path);
    }).then(() => {
        return path;
    });
  }

  delete (path) {

    return this.connect().then(() => {
        return this.sftpClient.delete(path);
    }).then((path) => {
        return path;
    });
  }

  deleteDirectory (path) {

    return this.connect().then(() => {
        return this.sftpClient.rmdir(path, true);
    });
  }

  rename (oldpath, newPath) {

    return this.connect().then(() => {
        return this.sftpClient.remove(oldpath, newPath);
    });
  }

  isFileOnServer(path, callback) {

    let directory = path.split('/');
    directory.pop();
    directory = directory.join('/');

    return this.connect().then(() => {
        return this.sftpClient.list(directory);
    }).then((list) => {
        let file = list.find(function(item){
            return item.name == path.split('/').slice(-1)[0];
        });
        return file;
    });

  }

  writeTextToFile (pathOnServer, pathOnDisk) {

    return this.connect().then(() => {
        return this.sftpClient.get(pathOnServer);
    }).then((stream) => {
        stream.once('close', () => { });
        stream.once('finish', () => { resolve(true); });
        stream.pipe(FileSystem.createWriteStream(pathOnDisk));
    });

  }

  saveFileToServer (content, serverPath, pathOnDisk = null) {

    return this.connect().then(() => {
        if(pathOnDisk === null) {
            return this.sftpClient.put(Buffer.from([]), serverPath);
        } else {
            return this.sftpClient.put(pathOnDisk, serverPath);
        }
    }).then(() => {
        this.showMessage('File successfully saved to the server.', '', 'success');
    }).catch(() => {});

  }

  loadFtpTree(path = "", elementToAdd) {

    let ftpPath = path + "/";
    if(path == "" || path == null) ftpPath = "";

    return this.connect().then(() => {
        return this.sftpClient.list(path);
    }).then((list) => {
        return this.createDirectoriesAndFiles(ftpPath, list, elementToAdd);
    });
    
  }

  testConnection() {
    return this.connect().then(() => {
        return this.sftpClient.list('/');
    }).then(() => {
        this.showMessage(':)', '', 'success');
    }).catch(() => {});
  }

}
