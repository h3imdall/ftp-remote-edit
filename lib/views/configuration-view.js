'use babel';

import path from 'path';
import { decrypt, encrypt, checkPassword } from './../helper/secure.js';
import { $, ScrollView, TextEditorView } from 'atom-space-pen-views';

const atom = global.atom;
const config = require('./../config/server-schema.json');

export default class ConfigurationView extends ScrollView {
  
  static content() {
    return this.div({
      class: 'ftp-remote-edit settings-view overlay from-top',
    }, () => {
      this.div({
        class: 'panels',
      }, () => {
        this.div({
          class: 'panels-item',
        }, () => {
          this.label({
            class: 'icon',
            outlet: 'info',
          });
          this.div({
            class: 'panels-content',
            outlet: 'elements',
          });
          this.div({
            class: 'panels-content',
            outlet: 'elements',
          });
        });
      });
      this.div({
        class: 'error-message',
        outlet: 'error',
      });
    });
  }

  constructor() {
    super();

    const self = this;

    self.password = null;
    self.configArray = [];
    self.disableEventhandler = false;

    let html = '<p>Ftp-Remote-Edit Server Settings</p>';
    html += "<p>You can edit each connection at the time. All changes will only be saved by pushing the save button.</p>";
    self.info.html(html);

    let saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.classList.add('btn');

    let closeButton = document.createElement('button');
    closeButton.textContent = 'Cancel';
    closeButton.classList.add('btn');
    closeButton.classList.add('pull-right');

    self.elements.append(self.createServerSelect());
    self.elements.append(self.createRequiredDiv());

    self.elements.append(saveButton);
    self.elements.append(closeButton);

    // Events
    closeButton.addEventListener('click', (event) => {
      self.close();
    });

    saveButton.addEventListener('click', (event) => {
      self.save();
      self.close();
    });

    // testButton.addEventListener('click', (event) => {
    //   self.test();
    // });
  }

  createRequiredDiv() {
    const self = this;

    nameLabel = document.createElement('label');
    nameLabel.textContent = 'The name of the server.';
    self.nameInput = new TextEditorView({ mini: true, placeholderText: "name" });

    hostLabel = document.createElement('label');
    hostLabel.textContent = 'The hostname or IP address of the server.';
    self.hostInput = new TextEditorView({ mini: true, placeholderText: "localhost" });

    portLabel = document.createElement('label');
    portLabel.textContent = 'The port of the server. Default: 21 (ftp), 22 (sftp).';
    self.portInput = new TextEditorView({ mini: true, placeholderText: "21" });

    userLabel = document.createElement('label');
    userLabel.textContent = `Username for authentication.`;
    self.userInput = new TextEditorView({ mini: true, placeholderText: "username" });

    passwordLabel = document.createElement('label');
    passwordLabel.textContent = `Password for authentication.`;
    self.passwordInput = new TextEditorView({ mini: true, placeholderText: "password" });

    let controlGroup = document.createElement('div');
    controlGroup.classList.add('control-group');

    let controls = document.createElement('div');
    controls.classList.add('controls');
    controlGroup.appendChild(controls);

    let checkboxDiv = document.createElement('div');
    checkboxDiv.classList.add('checkbox');
    controls.appendChild(checkboxDiv);

    let checkboxLabel = document.createElement('label');
    checkboxDiv.appendChild(checkboxLabel);

    let labelTitle = document.createElement('div');
    labelTitle.textContent = 'Use sftp (ssh) connection.';

    self.sftpInput = document.createElement('input');
    self.sftpInput.type = 'checkbox';
    self.sftpInput.checked = true;
    checkboxLabel.appendChild(self.sftpInput);
    checkboxLabel.appendChild(labelTitle);

    let divRequired = document.createElement('div');
    divRequired.classList.add('requiredDiv');

    divRequired.appendChild(nameLabel);
    divRequired.appendChild(self.nameInput.element);
    divRequired.appendChild(hostLabel);
    divRequired.appendChild(self.hostInput.element);
    divRequired.appendChild(userLabel);
    divRequired.appendChild(self.userInput.element);
    divRequired.appendChild(passwordLabel);
    divRequired.appendChild(self.passwordInput.element);
    divRequired.appendChild(portLabel);
    divRequired.appendChild(self.portInput.element);
    divRequired.appendChild(controlGroup);

    // Events
    self.nameInput.getModel()
      .onDidChange(() => {
        if (self.configArray.length !== 0 && !self.disableEventhandler) {
          let index = self.selectServer.selectedOptions[0].value;
          self.configArray[index].name = self.nameInput.getText()
            .trim();
          self.selectServer.selectedOptions[0].text = self.nameInput.getText()
            .trim();
        }
      });
    self.hostInput.getModel()
      .onDidChange(() => {
        if (self.configArray.length !== 0 && !self.disableEventhandler) {
          let index = self.selectServer.selectedOptions[0].value;
          self.configArray[index].host = self.hostInput.getText()
            .trim();
        }
      });
    self.portInput.getModel()
      .onDidChange(() => {
        if (self.configArray.length !== 0 && !self.disableEventhandler) {
          let index = self.selectServer.selectedOptions[0].value;
          self.configArray[index].port = self.portInput.getText()
            .trim();
        }
      });
    self.userInput.getModel()
      .onDidChange(() => {
        if (self.configArray.length !== 0 && !self.disableEventhandler) {
          let index = self.selectServer.selectedOptions[0].value;
          self.configArray[index].user = self.userInput.getText()
            .trim();
        }
      });
    self.passwordInput.getModel()
      .onDidChange(() => {
        if (self.configArray.length !== 0 && !self.disableEventhandler) {
          let index = self.selectServer.selectedOptions[0].value;
          self.configArray[index].password = self.passwordInput.getText()
            .trim();
        }
      });
    self.sftpInput.addEventListener('change', (event) => {
      if (self.configArray.length !== 0 && !self.disableEventhandler) {
        let index = self.selectServer.selectedOptions[0].value;
        self.configArray[index].sftp = self.sftpInput.checked;
      }
    });

    return divRequired;
  }

  createServerSelect() {
    const self = this;

    let div = document.createElement('div');
    div.style.marginBottom = '20px';

    let selectContainer = document.createElement('div');
    selectContainer.classList.add('select-container');

    let select = document.createElement('select');
    select.classList.add('form-control');
    selectContainer.appendChild(select);
    self.selectServer = select;
    self.selectServer.focus();

    let newButton = document.createElement('button');
    newButton.textContent = 'New';
    newButton.classList.add('btn');

    let deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('btn');
    deleteButton.classList.add('pull-right');

    // let testButton = document.createElement('button');
    // testButton.textContent = 'Test Connection';
    // testButton.classList.add('btn');
    // testButton.classList.add('pull-right');

    div.appendChild(selectContainer);
    selectContainer.appendChild(newButton);
    selectContainer.appendChild(deleteButton);

    // Events
    select.addEventListener('change', (event) => {
      if (self.configArray.length !== 0 && !self.disableEventhandler) {
        let option = event.currentTarget.selectedOptions[0];
        let indexInArray = option.value;

        self.nameInput.setText(self.configArray[indexInArray].name);
        self.hostInput.setText(self.configArray[indexInArray].host);
        self.portInput.setText(self.configArray[indexInArray].port);
        self.userInput.setText(self.configArray[indexInArray].user);
        self.passwordInput.setText(self.configArray[indexInArray].password);
        self.sftpInput.checked = self.configArray[indexInArray].sftp;
      }
    });

    newButton.addEventListener('click', (event) => {
      self.new();
    });

    deleteButton.addEventListener('click', (event) => {
      self.delete();
    });

    div.classList.add('controls');

    return div;
  }

  reload(loadConfig) {
    const self = this;

    if (!self.password) {
      return;
    }

    self.disableEventhandler = true;

    let configText = atom.config.get('ftp-remote-edit.config');
    if (configText && loadConfig) {
      try {
        configText = JSON.stringify(JSON.parse(configText), null, 4);
      } catch (e) {
        configText = decrypt(self.password, configText);
      }

      self.configArray = null;
      self.configArray = JSON.parse(configText)
        .sort((a, b) => {
          if (a.host < b.host) return -1;
          if (a.host > b.host) return 1;
          return 0;
        });
    }

    if (self.selectServer.options.length > 0) {
      for (i = self.selectServer.options.length - 1; i >= 0; i--) {
        self.selectServer.remove(i);
      }
    }

    if (self.configArray.length !== 0) {
      self.configArray.forEach((item, index) => {
        let option = document.createElement("option");
        option.text = item.name;
        option.value = index;
        self.selectServer.add(option);
      });

      self.nameInput.setText(self.configArray[0].name);
      self.hostInput.setText(self.configArray[0].host);
      self.portInput.setText(self.configArray[0].port);
      self.userInput.setText(self.configArray[0].user);
      self.passwordInput.setText(self.configArray[0].password);
      self.sftpInput.checked = self.configArray[0].sftp;

      // Enable Input Fields
      self.enableInputFields();
    } else {
      self.nameInput.setText('');
      self.hostInput.setText('');
      self.portInput.setText('');
      self.userInput.setText('');
      self.passwordInput.setText('');
      self.sftpInput.checked = false;

      // Disable Input Fields
      self.disableInputFields();
    }
    self.disableEventhandler = false;
  };

  attach() {
    this.panel = atom.workspace.addModalPanel({
      item: this
    });
  };

  close() {
    const self = this;

    self.configArray = [];
    const destroyPanel = this.panel;
    this.panel = null;
    if (destroyPanel) {
      destroyPanel.destroy();
    }

    atom.workspace.getActivePane()
      .activate();
  }

  cancel() {
    this.close();
  }

  showError(message) {
    this.error.text(message);
    if (message) {
      this.flashError();
    }
  }

  enableInputFields() {
    const self = this;

    self.nameInput.disabled = false;
    self.hostInput.disabled = false;
    self.portInput.disabled = false;
    self.userInput.disabled = false;
    self.passwordInput.disabled = false;

    self.nameInput[0].classList.remove('disabled');
    self.hostInput[0].classList.remove('disabled');
    self.portInput[0].classList.remove('disabled');
    self.userInput[0].classList.remove('disabled');
    self.passwordInput[0].classList.remove('disabled');
  }

  disableInputFields() {
    const self = this;

    self.nameInput[0].classList.add('disabled');
    self.nameInput.disabled = true;

    self.hostInput[0].classList.add('disabled');
    self.hostInput.disabled = true;

    self.portInput[0].classList.add('disabled');
    self.portInput.disabled = true;

    self.userInput[0].classList.add('disabled');
    self.userInput.disabled = true;

    self.passwordInput[0].classList.add('disabled');
    self.passwordInput.disabled = true;

    let changing = false;
    self.nameInput.getModel()
      .onDidChange(() => {
        if (!changing && self.nameInput.disabled) {
          changing = true;
          self.nameInput.setText('');
          changing = false;
        }
      });
    self.hostInput.getModel()
      .onDidChange(() => {
        if (!changing && self.hostInput.disabled) {
          changing = true;
          self.hostInput.setText('');
          changing = false;
        }
      });
    self.portInput.getModel()
      .onDidChange(() => {
        if (!changing && self.portInput.disabled) {
          changing = true;
          self.portInput.setText('');
          changing = false;
        }
      });
    self.userInput.getModel()
      .onDidChange(() => {
        if (!changing && self.userInput.disabled) {
          changing = true;
          self.userInput.setText('');
          changing = false;
        }
      });
    self.passwordInput.getModel()
      .onDidChange(() => {
        if (!changing && self.passwordInput.disabled) {
          changing = true;
          self.passwordInput.setText('');
          changing = false;
        }
      });
  }

  test() {
    //let indexInArray = this.selectServer.selectedOptions[0].value;
    //   let conn = this.configArray[indexInArray];

    //   if(conn.sftp === true) {
    //     ftp = new Sftp(conn);
    //   } else {
    //     ftp = new Ftp(conn);
    //   }
    //   ftp.testConnection();
  }

  new() {
    const self = this;

    self.enableInputFields();

    let newconfig = JSON.parse(JSON.stringify(config));
    newconfig.name = config.name + " " + (self.configArray.length + 1);
    self.configArray.push(newconfig);

    let option = document.createElement('option');
    option.text = newconfig.name;
    option.value = self.configArray.length - 1;

    this.selectServer.add(option);
    this.selectServer.value = self.configArray.length - 1;
    this.selectServer.dispatchEvent(new Event('change'));
  }

  save() {
    const self = this;

    if (self.configArray.length > 0) {
      atom.config.set('ftp-remote-edit.config', encrypt(self.password, JSON.stringify(self.configArray)));
    } else {
      atom.config.set('ftp-remote-edit.config', '');
    }
    self.close();
  }

  delete() {
    const self = this;

    if (self.configArray.length == 0) return;

    let index = self.selectServer.selectedOptions[0].value;
    self.configArray.splice(index, 1);

    self.reload();
  }
}
