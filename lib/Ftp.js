'use babel';

// import { View } from 'atom';
// import { CompositeDisposable } from 'atom';

import FileView from './file-view.js';
import ListView from './list-view.js';
import DirectoryView from './directory-view.js';
import Node from './Node.js';
import MessageView from './message-view.js';
import { File } from 'atom';

var ftpClient = require('ftp');
var FileSystem = require('fs');
const tempDirectory = require('os').tmpdir();


export default class Ftp  {

  constructor(connection) {
    // Create root element
    this.connection = connection;

  }


  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }


  connectWithFtpServer (nodeJsFtpClient) {
    
    try {
        let ftpConfig = this.connection;
        nodeJsFtpClient.connect(ftpConfig);
    } catch (error) {
        new MessageView('Could not connect to the following server: ' + JSON.stringify(this.connection, null, 4));
    }
  }

  isFileOnServer(path, callback) {

      var c = new ftpClient();

      let directory = path.split('/');
      directory.pop();
      directory = directory.join('/');

      c.on('ready', function() {
          c.list(directory, function(err, list) {

              if (err) {
                  atom.showErrorMessage(err.message);
                  c.end();
              } else {
                  c.end();

                  let file = list.find(function(item){
                      return item.name == path.split('/').slice(-1)[0];
                  });

                  callback(file);
              }

          });
      });

      this.connectWithFtpServer(c);

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

    var c = new ftpClient();

    c.on('ready', function() {
        c.put(content, serverPath, function(err, list) {

            if (err) {
                atom.showErrorMessage(err.message);
            } else {
              console.log('erfolgreich gespeichert');
            }
            c.end();
        });
    });

    this.connectWithFtpServer(c);

  }

  createDirectoriesAndFiles(ftpPath, list, elementToAdd) {

    let promise = new Promise((resolve, reject) => {

    console.log();

      try {
        let ftpPanel = null;

        atom.workspace.getLeftPanels().forEach((panel) => {
          if(panel.getItem() instanceof Node) {
            ftpPanel = panel;
            return false;
          }
        });

        let directories = list.filter((item) => {return item.type === 'd' && item.name !== '.' && item.name !== '..'; });
        let files = list.filter((item) => { return item.type === '-'; });

        let ul = new ListView();
        elementToAdd.append(ul);


        directories.forEach(function(element) {

            let pathOnFileSystem = ftpPath + element.name;
            pathOnFileSystem = pathOnFileSystem.replace('//', '/');

            let li = new DirectoryView({name: element.name, pathOnServer: pathOnFileSystem});
            ul.append(li);

        }, this);

        files.forEach(function(element) {

            let pathOnFileSystem = ftpPath + element.name;
            pathOnFileSystem = pathOnFileSystem.replace('//', '/');

            let li = new FileView({name: element.name, pathOnServer: pathOnFileSystem});
            ul.append(li);

        }, this);

        resolve(true);
      } catch (e) {
        reject(e);
      }

    });

    return promise;

  }

  loadFtpTree(path = "", elementToAdd) {

      let ftpPath = path + "/";
      if(path == "" || path == null) ftpPath = "";

      return this.loadDirectory(path).then((list) => {
          return this.createDirectoriesAndFiles(ftpPath, list, elementToAdd);
      });
  }

  loadDirectory (path) {

      let promise = new Promise((resolve, reject) => {

          var c = new ftpClient();

          c.on('ready', function() {
              c.list(path, function(err, list) {
                  if (err) {
                      console.log(err);
                      c.end();
                      reject(err);
                  } else {
                      c.end();
                      resolve(list);
                  }

              });
          });

          this.connectWithFtpServer(c);

      });

      return promise;

  }

}
