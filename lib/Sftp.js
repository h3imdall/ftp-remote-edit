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

   

  createDirectory (path) {

    return this.sftpClient.connect(this.connection).then(() => {
        return this.sftpClient.mkdir(path);
    }).then(() => {
        return path;
    }).catch((err) => {
        console.log(err);
    });
  }

  delete (path) {

    return this.sftpClient.connect(this.connection).then(() => {
        return this.sftpClient.delete(path);
    }).then((path) => {
        return path;
    }).catch((err) => {
        console.log(err);
    });
  }

  deleteDirectory (path) {

    return this.sftpClient.connect(this.connection).then(() => {
        return this.sftpClient.rmdir(path, true);
    }).catch((err) => {
        console.log(err);
    });
  }

  rename (oldpath, newPath) {

    return this.sftpClient.connect(this.connection).then(() => {
        return this.sftpClient.remove(oldpath, newPath);
    }).catch((err) => {
        console.log(err);
    });
  }

  isFileOnServer(path, callback) {

    let directory = path.split('/');
    directory.pop();
    directory = directory.join('/');

    return this.sftpClient.connect(this.connection).then(() => {
        return this.sftpClient.list(directory);
    }).then((list) => {
        let file = list.find(function(item){
            return item.name == path.split('/').slice(-1)[0];
        });
        return file;
    }).catch((err) => {
        console.log(err);
    });

  }

  writeTextToFile (pathOnServer, pathOnDisk) {

    return this.sftpClient.connect(this.connection).then(() => {
        return this.sftpClient.get(pathOnServer);
    }).then((stream) => {
        stream.once('close', () => { });
        stream.once('finish', () => { resolve(true); });
        stream.pipe(FileSystem.createWriteStream(pathOnDisk));
    }).catch((err) => {
        console.log(err);
    });

  }

  saveFileToServer (content, serverPath, pathOnDisk = null) {

    return this.sftpClient.connect(this.connection).then(() => {
        if(pathOnDisk === null) {
            return this.sftpClient.put(Buffer.from([]), serverPath);
        } else {
            return this.sftpClient.put(pathOnDisk, serverPath);
        }
    }).catch((err) => {
        console.log(err);
    });

  }

  loadFtpTree(path = "", elementToAdd) {

    let ftpPath = path + "/";
    if(path == "" || path == null) ftpPath = "";

    return this.sftpClient.connect(this.connection).then(() => {
        return this.sftpClient.list(path);
    }).then((list) => {
        return this.createDirectoriesAndFiles(ftpPath, list, elementToAdd);
    }).catch((err) => {
        console.log(err, this.connection);
    });
    
  }

}
