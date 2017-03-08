'use babel';

import {TextEditor} from 'atom';
import {File} from 'atom';

import Secure from './Secure.js';

export default class ConfigurationView {

  constructor(password) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('ftp-remote-edit');

    let secure = new Secure();

    this.textEditor = new TextEditor();
    let configText = atom.config.get('ftp-remote-edit.config');

    try {
      configText = JSON.stringify(JSON.parse(configText), null, 4);
    } catch (e) {
      configText = secure.decrypt(password, configText);
    }

    this.textEditor.setText(configText);

    let closeButton = document.createElement('button');
    closeButton.textContent = 'Cancel';
    closeButton.classList.add('btn');
    closeButton.style.marginTop = '20px';
    closeButton.addEventListener('click', (event) => {
      this.modal.destroy();
    });

    let saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.classList.add('btn');
    saveButton.style.marginTop = '20px';
    saveButton.addEventListener('click', (event) => {
      atom.config.set('ftp-remote-edit.reset', false);
      atom.config.set('ftp-remote-edit.config', secure.encrypt(password, this.textEditor.getText()));
      this.modal.destroy();
    });



    let label = document.createElement('label');
    label.textContent = `Now you can edit your connection Objects. The connection information is an array with connection objects.
                         For security connections click the link to learn more about the propertys for the connection object.
                         Look at the "connect" method. `;


    let link = document.createElement('a');
    link.textContent = 'https://github.com/mscdex/node-ftp';
    link.href = 'https://github.com/mscdex/node-ftp';
    label.appendChild(link);

    this.element.appendChild(label);
    this.element.appendChild(this.textEditor.element);
    this.element.appendChild(saveButton);
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

}
