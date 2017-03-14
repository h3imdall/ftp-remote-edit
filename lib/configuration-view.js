'use babel';

import {TextEditor} from 'atom';
import {File} from 'atom';

import Secure from './Secure.js';

export default class ConfigurationView {

  constructor(password) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('ftp-remote-edit');

    this.password = password;

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


    // this.element.appendChild(this.createSideDiv());

    this.element.appendChild(label);
    // this.element.appendChild(this.createRequiredDiv());
    // this.element.appendChild(this.createDivOptional());
    this.element.appendChild(this.textEditor.element);
    this.element.appendChild(saveButton);
    this.element.appendChild(closeButton);

  }

  createRequiredDiv () {

    hostLabel = document.createElement('label');
    hostLabel.textContent = 'The hostname or IP address of the FTP server.';
    portLabel = document.createElement('label');
    portLabel.textContent = 'The port of the FTP server. Default: 21';
    userLabel = document.createElement('label');
    userLabel.textContent = `Username for authentication. Default: 'anonymous'`;
    passwordLabel = document.createElement('label');
    passwordLabel.textContent = `Password for authentication. Default: 'anonymous@'`;

    hostInput = new TextEditor({mini: true});
    portInput = new TextEditor({mini: true}); 
    userInput = new TextEditor({mini: true}); 
    passwordInput = new TextEditor({mini: true});

    let divRequired = document.createElement('div');
    divRequired.classList.add('requiredDiv');

    divRequired.appendChild(hostLabel);
    divRequired.appendChild(hostInput.element);
    divRequired.appendChild(userLabel);
    divRequired.appendChild(userInput.element);
    divRequired.appendChild(passwordLabel);
    divRequired.appendChild(passwordInput.element);
    divRequired.appendChild(portLabel);
    divRequired.appendChild(portInput.element);

    return divRequired;
  }

  createDivOptional () {
    let secureLabel = document.createElement('label');
    let settingTitle = document.createElement('div');
    settingTitle.textContent = `Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990) Default: false`;
    settingTitle.classList.add('setting-title');
    let secureOptionsLabel = document.createElement('label');
    secureOptionsLabel.textContent = 'Object - Additional options to be passed to tls.connect(). Default: (none)';
    let connTimeoutLabel = document.createElement('label');
    connTimeoutLabel.textContent = 'How long (in milliseconds) to wait for the control connection to be established. Default: 10000';
    let pasvTimeoutLabel = document.createElement('label');
    pasvTimeoutLabel.textContent = 'How long (in milliseconds) to wait for a PASV data connection to be established. Default: 10000';
    let keepaliveLabel = document.createElement('label');
    keepaliveLabel.textContent = `How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. Default: 10000`;


    let secureInput = document.createElement('input');
    secureInput.classList.add('input-checkbox');
    let controlGroup = document.createElement('div');
    let controls = document.createElement('div');
    let checkboxDiv = document.createElement('div');
    controlGroup.appendChild(controls);
    controls.appendChild(checkboxDiv);
    checkboxDiv.appendChild(secureLabel);
    controlGroup.classList.add('control-group');
    controls.classList.add('controls');
    checkboxDiv.classList.add('checkbox');
    secureInput.type = 'checkbox';
    secureLabel.appendChild(secureInput);
    secureLabel.appendChild(settingTitle);
    


    secureOptionsInput = new TextEditor({mini: true}); 
    connTimeoutInput = new TextEditor({mini: true}); 
    pasvTimeoutInput = new TextEditor({mini: true}); 
    keepaliveInput = new TextEditor({mini: true}); 

    let divOptional = document.createElement('div');
    divOptional.classList.add('optionalDiv');

    divOptional.appendChild(controlGroup);
    divOptional.appendChild(secureOptionsLabel);
    divOptional.appendChild(secureOptionsInput.element);
    divOptional.appendChild(connTimeoutLabel);
    divOptional.appendChild(connTimeoutInput.element);
    divOptional.appendChild(pasvTimeoutLabel);
    divOptional.appendChild(pasvTimeoutInput.element);
    divOptional.appendChild(keepaliveLabel);
    divOptional.appendChild(keepaliveInput.element);

    return divOptional;
  }

  createSideDiv () {
    let div = document.createElement('div');

    div.classList.add('sideDiv');

    let secure = new Secure();
    let configText = atom.config.get('ftp-remote-edit.config');

    try {
      configText = JSON.stringify(JSON.parse(configText), null, 4);
    } catch (e) {
      configText = secure.decrypt(this.password, configText);
    }

    div.textContent = configText;

    return div;
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
