'use babel';


import Ftp from './Ftp.js';
var sftpClient = require('ssh2-sftp-client');

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

    let promise = new Promise((resolve, reject) => {

        var c = new ftpClient();

        c.on('ready', function() {
            c.mkdir(path, function(err) {

                if (err) {
                    c.end();
                    reject(err);
                } else {
                    c.end();
                    resolve(path);
                }
            });
        });

        this.connectWithFtpServer(c);

    });

    return promise;
  }

  delete (path) {

    let promise = new Promise((resolve, reject) => {

        var c = new ftpClient();

        c.on('ready', function() {
            c.delete(path, function(err) {

                if (err) {
                    c.end();
                    reject(err);
                } else {
                    c.end();
                    resolve(path);
                }
            });
        });

        this.connectWithFtpServer(c);

    });

    return promise;

  }

  deleteDirectory (path) {
    
    let promise = new Promise((resolve, reject) => {

        var c = new ftpClient();
        let recursive = true;

        c.on('ready', function() {
            c.rmdir(path, recursive, function(err) {

                if (err) {
                    c.end();
                    reject(err);
                } else {
                    c.end();
                    resolve(path);
                }
            });
        });

        this.connectWithFtpServer(c);

    });

    return promise;

  }

  rename (oldpath, newPath) {
    
    let promise = new Promise((resolve, reject) => {

        var c = new ftpClient();
        let recursive = true;

        c.on('ready', function() {
            c.rename(oldpath, newPath, function(err) {

                if (err) {
                    c.end();
                    reject(err);
                } else {
                    c.end();
                    resolve(path);
                }
            });
        });

        this.connectWithFtpServer(c);

    });

    return promise;

  }

  isFileOnServer(path, callback) {

    let promise = new Promise((resolve, reject) => {

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
        });

    }); 

    return promise;

  }

  writeTextToFile (pathOnServer, pathOnDisk) {

    let promise = new Promise((resolve, reject) => {

      var c = new ftpClient();

      c.on('ready', () => {
        c.get(pathOnServer, (err, stream) => {
          if(err) {
            atom.showErrorMessage(err.message);
          } else {
            stream.once('close', () => {c.end(); });
            stream.once('finish', () => { resolve(true); });
            stream.pipe(FileSystem.createWriteStream(pathOnDisk));
          }
        });
      });

      this.connectWithFtpServer(c);
    });

    return promise;
  }

  saveFileToServer (content, serverPath) {

    let promise = new Promise((resolve, reject) => {

        var c = new ftpClient();

        c.on('ready', function() {
            c.put(content, serverPath, function(err, list) {

                if (err) {
                    reject(err);                    
                } else {
                    console.log('erfolgreich gespeichert');
                    resolve(true);
                }
                c.end();
            });
        });

        this.connectWithFtpServer(c);
    });

    return promise;


  }

  loadFtpTree(path = "", elementToAdd) {

    let ftpPath = path + "/";
    if(path == "" || path == null) ftpPath = "";

    return this.sftpClient.connect(this.connection).then(() => {
        return this.sftpClient.list(path);
    }).then((list) => {
        return this.createDirectoriesAndFiles(ftpPath, list, elementToAdd);
    });
    
  }

}
