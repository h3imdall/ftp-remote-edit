'use babel';

import {TextEditor} from 'atom';
import {File} from 'atom';

import Secure from './Secure.js';

export default class ConfigurationView {

  constructor(password) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('ftp-remote-edit');
    this.element.classList.add('settings-view');

    let panels = document.createElement('div');
    let panelsItem = document.createElement('div');
    panels.classList.add('panels');
    panelsItem.classList.add('panels-item');

    this.element.appendChild(panels);
    panels.appendChild(panelsItem);

    this.configArray = [];
    this.password = password;

    let secure = new Secure();

    // this.textEditor = new TextEditor();
    // let configText = atom.config.get('ftp-remote-edit.config');
    // try {
    //   configText = JSON.stringify(JSON.parse(configText), null, 4);
    // } catch (e) {
    //   configText = secure.decrypt(password, configText);
    // }
    // this.textEditor.setText(configText);

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
      atom.config.set('ftp-remote-edit.config', secure.encrypt(password, JSON.stringify(this.configArray)));
      this.modal.destroy();
    });

    let deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('btn');
    deleteButton.style.marginTop = '20px';
    deleteButton.addEventListener('click', (event) => {

      if(this.configArray.length === 0) return false;

      this.hostInput.setText('');
      this.portInput.setText('');
      this.userInput.setText('');
      this.passwordInput.setText('');
      this.sftpInput.checked = false;

      let index = this.selectServer.selectedOptions[0].value;
      this.configArray.splice(index, 1);
      this.selectServer.selectedOptions[0].remove();

      function removeAllOptionsFromSelect(selectServer) {
        if(selectServer.options.length > 0) {
          selectServer.options[0].remove();
          removeAllOptionsFromSelect(selectServer);
        }
      }
      removeAllOptionsFromSelect(this.selectServer);

      this.configArray.forEach((item, index) => {
        let option = document.createElement("option");
        option.text = item.host;
        option.value = index;
        this.selectServer.add(option);
      });

      this.selectServer.selectedIndex = 0;
      this.selectServer.dispatchEvent(new Event('change'));

    });


    let label = document.createElement('label');
    label.textContent = `Now you can edit your connection data. With the checkbox you toggle between ftp and sftp(ssh).
                        You can edit each connection at the time. All changes will only be saved on pushing the save button.`;
    
    let requiredDiv = this.createRequiredDiv();

    panelsItem.appendChild(label);
    panelsItem.appendChild(this.createServerSelect());
    panelsItem.appendChild(requiredDiv);
    // this.element.appendChild(this.textEditor.element);
    panelsItem.appendChild(saveButton);
    panelsItem.appendChild(deleteButton);
    panelsItem.appendChild(closeButton);

  }

  createRequiredDiv () {

    hostLabel = document.createElement('label');
    hostLabel.textContent = 'The hostname or IP address of the server.';
    portLabel = document.createElement('label');
    portLabel.textContent = 'The port of the FTP server. Default for ftp: 21 and for sftp: 22.';
    userLabel = document.createElement('label');
    userLabel.textContent = `Username for authentication.`;
    passwordLabel = document.createElement('label');
    passwordLabel.textContent = `Password for authentication.`;

    let controlGroup = document.createElement('div');     controlGroup.classList.add('control-group');
    let controls = document.createElement('div');         controls.classList.add('controls'); controlGroup.appendChild(controls);
    let checkboxDiv = document.createElement('div');      checkboxDiv.classList.add('checkbox'); controls.appendChild(checkboxDiv);  
    let checkboxLabel = document.createElement('label');  checkboxDiv.appendChild(checkboxLabel);
    let labelTitle = document.createElement('div');
    labelTitle.textContent = 'Use sftp(ssh) connection.';

    this.hostInput = new TextEditor({mini: true});
    this.portInput = new TextEditor({mini: true}); 
    this.userInput = new TextEditor({mini: true}); 
    this.passwordInput = new TextEditor({mini: true});
    this.sftpInput = document.createElement('input');
    this.sftpInput.type = 'checkbox';
    this.sftpInput.checked = true;
    checkboxLabel.appendChild(this.sftpInput);
    checkboxLabel.appendChild(labelTitle);

    this.sftpInput.addEventListener('change', (event) => {
      let index = this.selectServer.selectedOptions[0].value;
      this.configArray[index].sftp = this.sftpInput.checked
    });
    this.hostInput.onDidChange(() => {
      let index = this.selectServer.selectedOptions[0].value;
      this.configArray[index].host = this.hostInput.getText();
      this.selectServer.selectedOptions[0].text = this.hostInput.getText();
    });
    this.portInput.onDidChange(() => {
      let index = this.selectServer.selectedOptions[0].value;
      this.configArray[index].port = this.portInput.getText();
    });
    this.userInput.onDidChange(() => {
      let index = this.selectServer.selectedOptions[0].value;
      this.configArray[index].user = this.userInput.getText();
    });
    this.passwordInput.onDidChange(() => {
      let index = this.selectServer.selectedOptions[0].value;
      this.configArray[index].password = this.passwordInput.getText();
    });


    let divRequired = document.createElement('div');
    divRequired.classList.add('requiredDiv');

    divRequired.appendChild(hostLabel);
    divRequired.appendChild(this.hostInput.element);
    divRequired.appendChild(userLabel);
    divRequired.appendChild(this.userInput.element);
    divRequired.appendChild(passwordLabel);
    divRequired.appendChild(this.passwordInput.element);
    divRequired.appendChild(portLabel);
    divRequired.appendChild(this.portInput.element);
    divRequired.appendChild(controlGroup);

    return divRequired;
  }

  createServerSelect () {
    let div = document.createElement('div');
    div.style.marginBottom = '20px';

    let secure = new Secure();
    let configText = atom.config.get('ftp-remote-edit.config');
    
    try {
      configText = JSON.stringify(JSON.parse(configText), null, 4);
    } catch (e) {
      configText = secure.decrypt(this.password, configText);
    }
    this.configArray = JSON.parse(configText);


    let controlLabel = document.createElement('label');
    div.appendChild(controlLabel);

    let selectContainer = document.createElement('div');
    selectContainer.classList.add('select-container');
    div.appendChild(selectContainer);

    let select = document.createElement('select');
    this.selectServer = select;
    select.classList.add('form-control');
    selectContainer.appendChild(select);
    this.configArray.forEach((item, index) => {
      let option = document.createElement("option");
      option.text = item.host;
      option.value = index;
      select.add(option);
    });

    select.addEventListener('change', (event) => {

      if(this.configArray.length !== 0) {
        let option = event.currentTarget.selectedOptions[0];
        let indexInArray = option.value;
        
        this.hostInput.setText(this.configArray[indexInArray].host);
        this.portInput.setText(this.configArray[indexInArray].port);
        this.userInput.setText(this.configArray[indexInArray].user);
        this.passwordInput.setText(this.configArray[indexInArray].password);
        this.sftpInput.checked = this.configArray[indexInArray].sftp;
      }

    });

    this.hostInput.setText(this.configArray[0].host);
    this.portInput.setText(this.configArray[0].port);
    this.userInput.setText(this.configArray[0].user);
    this.passwordInput.setText(this.configArray[0].password);
    this.sftpInput.checked = this.configArray[0].sftp;


    let newButton = document.createElement('button');
    newButton.textContent = 'New';
    newButton.classList.add('btn');
    newButton.addEventListener('click', (event) => {
      let connObj = {
        host: '127.0.0.1',
        user: '',
        port: '21',
        password: '',
        sftp: false
      };
      this.configArray.push(connObj);

      let option = document.createElement('option');
      option.text = connObj.host;
      option.value = this.configArray.length - 1;
      this.selectServer.add(option);
      this.selectServer.value = this.configArray.length - 1;
      this.selectServer.dispatchEvent(new Event('change'));
    });
    selectContainer.appendChild(newButton);


    div.classList.add('controls');

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
