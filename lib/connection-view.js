'use babel';

import Secure from './Secure.js';
import DirectoryView from './directory-view.js';
import FileView from './file-view.js';
import ListView from './list-view.js';
import Node from './Node.js';
import Ftp from './Ftp.js';

export default class ConnectionView {

  constructor(password) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('ftp-remote-edit');

    let closeButton = document.createElement('button');
    closeButton.textContent = 'Cancel';
    closeButton.classList.add('btn');
    closeButton.addEventListener('click', (event) => {
      this.modal.destroy();
    });

    let secure = new Secure();

    let connectionHash = atom.config.get('ftp-remote-edit.config');
    let connectionString = secure.decrypt(password, connectionHash);
    let connectionArr = JSON.parse(connectionString);

    connectionArr.forEach((connection) => {

      let div = document.createElement('div');
      let label = document.createElement('label');
      label.textContent = connection.host;

      let button = document.createElement('button');
      button.classList.add('btn');
      button.textContent = 'Connect';
      button.style.marginRight = '25px';
      button.style.marginBottom = '5px';
      button.addEventListener('click', () => {
        this.modal.destroy();
        this.connectWithServer(connection);
      });

      div.appendChild(button);
      div.appendChild(label);
      this.element.appendChild(div);
    });

    this.element.appendChild(closeButton);
  }


  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

  setModal (modal) {
    this.modal = modal;
  }

  connectWithServer (connection) {

    let leftPanels = atom.workspace.getLeftPanels();
    leftPanels.forEach((item) => {
      if(item.getItem() instanceof Node) {
        item.destroy();
      }
    });

    let ul = new ListView();
    let li = new DirectoryView({name: connection.host, pathOnServer: ''}, true);
    ul.append(li);

    let div = new Node();
    div.setConnection(connection);
    div.getElement().classList.add('directory-list-box');
    div.append(ul);

    this.ftpPanel = atom.workspace.addLeftPanel({
      item: div,
      visible: true,
      priority: 100
    });

    let ftp = new Ftp(connection);
    ftp.loadFtpTree();

  }

}
