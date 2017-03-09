'use babel';

import {TextEditor} from 'atom'
import ConfigurationView from './configuration-view.js';

import Secure from './Secure.js';
import DirectoryView from './directory-view.js';
import FileView from './file-view.js';
import ListView from './list-view.js';
import Node from './Node.js';
import Ftp from './Ftp.js';


export default class FtpRemoteEditView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('ftp-remote-edit');

    let resetConfig = atom.config.get('ftp-remote-edit.reset');
    this.passwordLabel = 'Insert your password';
    if(resetConfig === true) {
      this.passwordLabel = 'Define a password to protect your connection information.';
      atom.config.set('ftp-remote-edit.config', this.getDefaultConnectionValue());
    }

    let label = document.createElement('label');
    label.textContent = this.passwordLabel;
    this.element.appendChild(label);

    this.miniEditor = new TextEditor({mini: true});
    this.element.appendChild(this.miniEditor.element);
    

    let closeButton = document.createElement('button');
    closeButton.textContent = 'Cancel';
    closeButton.classList.add('btn');
    this.element.appendChild(closeButton);
    closeButton.addEventListener('click', (event) => {
      atom.workspace.getModalPanels().forEach((modal) => {
        modal.hide();
      });
    });

    let resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Passwort';
    resetButton.classList.add('btn');
    resetButton.classList.add('pull-right');
    this.element.appendChild(resetButton);
    resetButton.addEventListener('click', (event) => {
      atom.config.set('ftp-remote-edit.reset', true);
      atom.config.set('ftp-remote-edit.password', '');
      atom.workspace.getModalPanels().forEach((modal) => {
        modal.hide();
      });
    });

    atom.commands.add(this.element, 'core:confirm', () => {
      let password = this.miniEditor.getText();
      let secure = new Secure();

      // Password überprüfen
      if(atom.config.get('ftp-remote-edit.reset') === false ) {
        if(secure.checkPassword(password) === false) {
          window.alert('Wrong Password');
          return false;
        }
      } else {
        // Passwort als hash speichern.
        atom.config.set('ftp-remote-edit.password', secure.encrypt(password, password));
      }

      this.panel.destroy();


      if(this.state === 'editview') {
        let configView = new ConfigurationView(password);
        let modal = atom.workspace.addModalPanel({
          item: configView.getElement(),
          visible: true
        });
        configView.setModal(modal);
      } else {
        this.showFtpPanel(password);
      }

    });

  }

  setPanel (panel) {
    this.panel = panel;
  }

  getDefaultConnectionValue () {

    return JSON.stringify([
                            {
                                 "host": "",
                                 "user": "",
                                 "password": "",
                                 "port": "21",
                                 "sftp": false
                             }
                          ], null, 4);

  }

  setState (state) {
    this.state = state;
    let resetConfig = atom.config.get('ftp-remote-edit.reset');
    if(resetConfig === true) {
      this.passwordLabel.textContent = 'Define a password to protect your connection information.';
    } else {
      this.passwordLabel.textContent = 'Insert your password.';
    }

  }

  showFtpPanel (password) {

    let leftPanels = atom.workspace.getLeftPanels();
    leftPanels.forEach((item) => {
      if(item.getItem() instanceof Node) {
        item.destroy();
      }
    });

    let secure = new Secure();
    let connectionHash = atom.config.get('ftp-remote-edit.config');
    let connectionString = secure.decrypt(password, connectionHash);
    let connectionArr = JSON.parse(connectionString);

    let div = new Node();
    div.getElement().classList.add('directory-list-box');

    connectionArr.sort(function(a, b){
        if(a.host < b.host) return -1;
        if(a.host > b.host) return 1;
        return 0;
    });

    connectionArr.forEach((connection) => {

        let ul = new ListView();
        let li = new DirectoryView({name: connection.host, pathOnServer: ''}, true);

        div.append(ul);
        ul.setConnection(connection);
        ul.append(li);
    });

    this.ftpPanel = atom.workspace.addLeftPanel({
      item: div,
      visible: true,
      priority: 100
    });

    // let ftp = new Ftp(connection);
    // ftp.loadFtpTree();

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

}
