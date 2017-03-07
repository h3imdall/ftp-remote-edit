'use babel';

import {TextEditor} from 'atom'
import ConfigurationView from './configuration-view.js';
import ConnectionView from './connection-view.js'

import Secure from './Secure.js';

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

    let miniEditor = new TextEditor({mini: true});
    this.element.appendChild(miniEditor.element);

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
      let password = miniEditor.getText();
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

      atom.workspace.getModalPanels().forEach((modal) => { modal.hide(); });

      atom.config.set('ftp-remote-edit.reset', false);

      if(this.state === 'editview') {
        let configView = new ConfigurationView(password);
        let modal = atom.workspace.addModalPanel({
          item: configView.getElement(),
          visible: true
        });
        configView.setModal(modal);
      } else {
        let connectionView = new ConnectionView(password);
        let modal = atom.workspace.addModalPanel({
          item: connectionView.getElement(),
          visible: true
        });
        connectionView.setModal(modal);
      }

    });

  }

  getDefaultConnectionValue () {

    return JSON.stringify([
                            {
                                 "host": "",
                                 "user": "",
                                 "password": "",
                                 "port": "21"
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
