'use babel';

// import { View } from 'atom';
// import { CompositeDisposable } from 'atom';

import FileView from './file-view.js';
import ListView from './list-view.js';
import Node from './Node.js';
import Ftp from './Ftp.js';
import Sftp from './Sftp.js';

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

    this.directoryIconOpenClose = document.createElement('div');
    this.directoryIconOpenClose.classList.add('closeIcon');
    this.directoryIconOpenClose.node = this;
    this.element.appendChild(this.directoryIconOpenClose);

    // Create message element
    const message = document.createElement('span');
    message.textContent = pathObj.name;
    this.element.setAttribute("pathOnServer", pathObj.pathOnServer);
    message.classList.add('message');
    message.classList.add('icon');
    message.classList.add('clear');
    if(isRoot) {
      message.classList.add('icon-repo');
    } else {
      message.classList.add('icon-file-directory');
    }
    this.directoryIconOpenClose.appendChild(message);

    this.directoryIconOpenClose.addEventListener('click', (event) => {
        event.preventDefault();

        document.querySelectorAll('li > div.selected').forEach((item) => { item.classList.remove('selected'); });
               
        if(this.getChildNodes().length > 0) {
          this.closeDirectory();
        } else {
          this.openDirectory().then(() => {});          
        }

        return false;
    });

    this.directoryIconOpenClose.addEventListener('contextmenu', (event) => {
      document.querySelectorAll('li > div.selected').forEach((item) => { item.classList.remove('selected'); });
      this.directoryIconOpenClose.classList.add('selected');
    });

    // this.addDragAndDrop();

  }

  openDirectory () {
    this.loader = this.createLoader();
    this.element.appendChild(this.loader);
    let ftp = null;    
    
    if(this.getConnection().sftp === true) {
      ftp = new Sftp(this.getConnection());
    } else {
      ftp = new Ftp(this.getConnection());
    }

    return ftp.loadFtpTree(this.element.getAttribute('pathOnServer'), this).then(() => {
      this.directoryIconOpenClose.classList.add('selected');
      this.directoryIconOpenClose.classList.toggle('closeIcon');
      this.directoryIconOpenClose.classList.toggle('openIcon');
      this.loader.remove();
    });
  }

  closeDirectory () {
    this.getChildNodes().forEach((item) => { item.destroy(); });
    this.removeChildren();
    this.directoryIconOpenClose.classList.add('selected');
    this.directoryIconOpenClose.classList.toggle('closeIcon');
    this.directoryIconOpenClose.classList.toggle('openIcon');
  }

  addDragAndDrop () {

    this.directoryIconOpenClose.addEventListener('dragover', (event) => {
      // console.log(event);
      event.dataTransfer.dropEffect = "copy";
    }); 

    this.element.addEventListener('drop', (event) => {
      event.preventDefault();
      console.log(event);
      this.element.classList.remove('drag');
    });

    this.directoryIconOpenClose.addEventListener('dragenter', (event) => {
      event.preventDefault();
      this.element.classList.add('drag');
    });

    this.directoryIconOpenClose.addEventListener('dragleave', (event) => {
      event.preventDefault();
      this.element.classList.remove('drag');
    });

  }


}
