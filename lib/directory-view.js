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
    if(isRoot === true) {
      this.element.classList.add('rootDirectory');
      this.element.setAttribute('servername', pathObj.name);
    }

    let directoryIconOpenClose = document.createElement('div');
    directoryIconOpenClose.classList.add('closeIcon');
    this.element.appendChild(directoryIconOpenClose);

    // Create message element
    const message = document.createElement('span');
    message.textContent = pathObj.name;
    this.element.setAttribute("pathOnServer", pathObj.pathOnServer);
    message.classList.add('message');
    message.classList.add('icon');
    message.classList.add('clear');
    message.classList.add('icon-file-directory');
    directoryIconOpenClose.appendChild(message);

    directoryIconOpenClose.addEventListener('click', (event) => {
        event.preventDefault();

        document.querySelectorAll('li > div.selected').forEach((item) => { item.classList.remove('selected'); });
        
        let ftp = new Ftp(this.getConnection());

        if(this.getChildNodes().length > 0) {
          this.getChildNodes().forEach((item) => { item.destroy(); });
          this.removeChildren();
          directoryIconOpenClose.classList.add('selected');
          directoryIconOpenClose.classList.toggle('closeIcon');
          directoryIconOpenClose.classList.toggle('openIcon');
        } else {

          this.loader = this.createLoader();
          this.element.appendChild(this.loader);
          
          ftp.loadFtpTree(this.element.getAttribute('pathOnServer'), this).then(() => {
            directoryIconOpenClose.classList.add('selected');
            directoryIconOpenClose.classList.toggle('closeIcon');
            directoryIconOpenClose.classList.toggle('openIcon');
            this.loader.remove();
          });
        }

        return false;
    });

  }


}
