'use babel';

// import { View } from 'atom';
// import { CompositeDisposable } from 'atom';

import FileView from './file-view.js';
import ListView from './list-view.js';
import Node from './Node.js';
import Ftp from './Ftp.js';

var ftpClient = require('ftp');


export default class DirectoryView extends Node {

  constructor(pathObj, isRoot = false) {
    // Create root element

    super();

    this.isRoot = isRoot;
    this.element = document.createElement('li');
    this.element.classList.add('directory');
    if(isRoot === true) this.element.classList.add('rootDirectory');

    // Create message element
    const message = document.createElement('div');
    message.textContent = pathObj.name;
    this.element.setAttribute("pathOnServer", pathObj.pathOnServer);
    message.classList.add('message');
    message.classList.add('icon');
    message.classList.add('icon-file-directory');

    this.element.appendChild(message);


    if(isRoot === false) {
      message.addEventListener('click', (event) => {
          event.preventDefault();

          let ftp = new Ftp(this.getConnection());

          if(this.getChildNodes().length > 0) {
              this.getChildNodes().forEach((item) => { item.destroy(); });
              this.removeChildren();
          } else {

            this.loader = this.createLoader();
            this.element.appendChild(this.loader);

            ftp.loadFtpTree(this.element.getAttribute('pathOnServer')).then(() => {
              this.loader.remove();
            });
          }

          return false;
      });
    }

  }


}
