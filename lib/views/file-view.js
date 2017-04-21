'use babel';

// import { View } from 'atom';
// import { CompositeDisposable } from 'atom';

import { File } from 'atom';
import Node from './../Node.js';
import Ftp from './../connectors/ftp.js';
import Sftp from './../connectors/sftp.js';

var ftpClient = require('ftp');
var FileSystem = require('fs');
const tempDirectory = require('os').tmpdir();


export default class FileView extends Node {

  constructor(pathObj) {
    // Create root element

    super();

    this.element = document.createElement('li');
    this.element.classList.add('file');
    this.pathonDisk = null;

    // Create message element
    const message = document.createElement('div');
    message.textContent = pathObj.name;
    message.node = this;
    this.element.setAttribute("pathOnServer", pathObj.pathOnServer);
    message.classList.add('message');
    message.classList.add('icon');
    message.classList.add('icon-file-text');
    this.element.appendChild(message);

    message.addEventListener('click', (event) => {

        let ftp = null
        if(this.getConnection().sftp === true) {
          ftp = new Sftp(this.getConnection());
        } else {
          ftp = new Ftp(this.getConnection());
        }
        document.querySelectorAll('li > div.selected').forEach((item) => { item.classList.remove('selected'); });

        this.loader = this.createLoader();
        this.element.appendChild(this.loader);

        ftp.isFileOnServer(this.getPathOnServer()).then((file) => {
          if(file !== undefined && file !== null) {

              let serverName = document.getElementsByClassName('rootDirectory')[0].childNodes[0].textContent;

              this.pathonDisk = tempDirectory + '/' + serverName + '/' + this.getPathOnServer();
              let arrPath = this.pathonDisk.split('/');
              arrPath.pop();
              this.checkPath(arrPath);

              // let fileExists = FileSystem.existsSync(this.pathonDisk);
              // this.fileOnDisk = new File(this.pathonDisk);

              ftp.writeTextToFile(this.getPathOnServer(), this.pathonDisk).then(() => {
                return atom.workspace.open(this.pathonDisk);
              }).then((editor) => {

                this.loader.remove();
                message.classList.add('selected');

                if(this.editor === null || this.editor === undefined) {
                  this.editor = editor;

                  editor.onDidSave((saveObject) => {
                    ftp.saveFileToServer(editor.getText(), this.getPathOnServer(), editor.getPath());
                  });

                  editor.onDidDestroy(() => {
                    this.editor = null;
                  });
                }

              });

          }
        });
    });

    message.addEventListener('contextmenu', (event) => {
      document.querySelectorAll('li > div.selected').forEach((item) => { item.classList.remove('selected'); });
      message.classList.add('selected');
    });

  }


  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  checkPath (arrPath) {

    arrPath.reduce((path, dir) => {
      path += '/' + dir;
      if(!FileSystem.existsSync(path)) {
        FileSystem.mkdirSync(path);
      }
      return path;
    });

  }

}
