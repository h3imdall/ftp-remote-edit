'use babel';

import path from 'path';
import { decrypt, encrypt, checkPassword } from './../helper/secure.js';
import { $, ScrollView, TextEditorView } from 'atom-space-pen-views';
import { TextBuffer } from 'atom';
import { cleanJsonString } from './../helper/format.js';
import { throwErrorIssue44 } from './../helper/issue.js';

var FileSystem = require('fs-plus');
const atom = global.atom;
const config = require('./../config/server-schema.json');
const debugConfig = __dirname + './../config/server-test-schema.json';

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

    atom.commands.add(this.element, {
      'core:confirm': () => {
        // self.save();
      },
      'core:cancel': () => {
        self.cancel();
      },
    });
  }

  createRequiredDiv() {
    const self = this;

    let nameLabel = document.createElement('label');
    nameLabel.classList.add('control-label');
    let nameLabelTitle = document.createElement('div');
    nameLabelTitle.textContent = 'The name of the server.';
    nameLabelTitle.classList.add('setting-title');
    nameLabel.appendChild(nameLabelTitle);
    self.nameInput = new TextEditorView({ mini: true, placeholderText: "name" });

    let hostLabel = document.createElement('label');
    hostLabel.classList.add('control-label');
    let hostLabelTitle = document.createElement('div');
    hostLabelTitle.textContent = 'The hostname or IP address of the server.';
    hostLabelTitle.classList.add('setting-title');
    hostLabel.appendChild(hostLabelTitle);
    self.hostInput = new TextEditorView({ mini: true, placeholderText: "localhost" });

    let portLabel = document.createElement('label');
    portLabel.classList.add('control-label');
    let portLabelTitle = document.createElement('div');
    portLabelTitle.textContent = 'Port';
    portLabelTitle.classList.add('setting-title');
    portLabel.appendChild(portLabelTitle);
    self.portInput = new TextEditorView({ mini: true, placeholderText: "21" });

    let userLabel = document.createElement('label');
    userLabel.classList.add('control-label');
    let userLabelTitle = document.createElement('div');
    userLabelTitle.textContent = `Username for authentication.`;
    userLabelTitle.classList.add('setting-title');
    userLabel.appendChild(userLabelTitle);
    self.userInput = new TextEditorView({ mini: true, placeholderText: "username" });

    let passwordLabel = document.createElement('label');
    passwordLabel.classList.add('control-label');
    let passwordLabelTitle = document.createElement('div');
    passwordLabelTitle.textContent = `Password/Passphrase for authentication.`;
    passwordLabelTitle.classList.add('setting-title');
    passwordLabel.appendChild(passwordLabelTitle);
    self.passwordInput = new TextEditorView({ mini: true, placeholderText: "password" });

    let protocolLabel = document.createElement('label');
    protocolLabel.classList.add('control-label');
    let protocolTitle = document.createElement('div');
    protocolTitle.classList.add('setting-title')
    protocolTitle.textContent = 'Use sftp (ssh) connection.';
    self.sftpInput = document.createElement('input');
    self.sftpInput.type = 'checkbox';
    self.sftpInput.checked = true;
    self.sftpInput.classList.add('input-checkbox');

    let privatekeyfileLabel = document.createElement('label');
    privatekeyfileLabel.classList.add('control-label');
    let privatekeyfileLabelTitle = document.createElement('div');
    privatekeyfileLabelTitle.textContent = `Path to private keyfile.`;
    privatekeyfileLabelTitle.classList.add('setting-title');
    privatekeyfileLabel.appendChild(privatekeyfileLabelTitle);
    self.privatekeyfileInput = new TextEditorView({ mini: true, placeholderText: "path to private keyfile (optional)" });

    let remoteLabel = document.createElement('label');
    remoteLabel.classList.add('control-label');
    let remoteLabelTitle = document.createElement('div');
    remoteLabelTitle.textContent = `Initial Directory.`;
    remoteLabelTitle.classList.add('setting-title');
    remoteLabel.appendChild(remoteLabelTitle);
    self.remoteInput = new TextEditorView({ mini: true, placeholderText: "/" });

    let divRequired = document.createElement('div');
    divRequired.classList.add('requiredDiv');

    let nameControl = document.createElement('div');
    nameControl.classList.add('controls');
    nameControl.classList.add('name');
    nameControl.appendChild(nameLabel);
    nameControl.appendChild(self.nameInput.element);

    let hostControl = document.createElement('div');
    hostControl.classList.add('controls');
    hostControl.classList.add('host');
    hostControl.appendChild(hostLabel);
    hostControl.appendChild(self.hostInput.element);

    let portControl = document.createElement('div');
    portControl.classList.add('controls');
    portControl.classList.add('port');
    portControl.appendChild(portLabel);
    portControl.appendChild(self.portInput.element);

    let serverGroup = document.createElement('div');
    serverGroup.classList.add('control-group');
    serverGroup.appendChild(nameControl);
    serverGroup.appendChild(hostControl);
    serverGroup.appendChild(portControl);
    divRequired.appendChild(serverGroup);

    let usernameControl = document.createElement('div');
    usernameControl.classList.add('controls');
    usernameControl.classList.add('username');
    usernameControl.appendChild(userLabel);
    usernameControl.appendChild(self.userInput.element);

    let passwordControl = document.createElement('div');
    passwordControl.classList.add('controls');
    passwordControl.classList.add('password');
    passwordControl.appendChild(passwordLabel);
    passwordControl.appendChild(self.passwordInput.element);

    let credentialGroup = document.createElement('div');
    credentialGroup.classList.add('control-group');
    credentialGroup.appendChild(usernameControl);
    credentialGroup.appendChild(passwordControl);
    divRequired.appendChild(credentialGroup);

    let protocolControl = document.createElement('div');
    protocolControl.classList.add('controls');
    protocolControl.classList.add('protocol');
    protocolControl.classList.add('checkbox');
    protocolControl.appendChild(protocolLabel);
    protocolLabel.appendChild(self.sftpInput);
    protocolLabel.appendChild(protocolTitle);

    let protocolGroup = document.createElement('div');
    protocolGroup.classList.add('control-group');
    protocolGroup.appendChild(protocolControl);
    divRequired.appendChild(protocolGroup);

    self.privatekeyfileControl = document.createElement('div');
    self.privatekeyfileControl.classList.add('controls');
    self.privatekeyfileControl.classList.add('privatekeyfile');
    self.privatekeyfileControl.appendChild(privatekeyfileLabel);
    self.privatekeyfileControl.appendChild(self.privatekeyfileInput.element);

    let remoteControl = document.createElement('div');
    remoteControl.classList.add('controls');
    remoteControl.classList.add('remote');
    remoteControl.appendChild(remoteLabel);
    remoteControl.appendChild(self.remoteInput.element);

    let advancedSettingsGroup = document.createElement('div');
    advancedSettingsGroup.classList.add('control-group');
    advancedSettingsGroup.appendChild(self.privatekeyfileControl);
    advancedSettingsGroup.appendChild(remoteControl);
    divRequired.appendChild(advancedSettingsGroup);

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

    let changing = false;
    const passwordModel = self.passwordInput.getModel();
    passwordModel.clearTextPassword = new TextBuffer('');
    passwordModel.buffer.onDidChange((obj) => {
      if (!changing) {
        changing = true;
        passwordModel.clearTextPassword.setTextInRange(obj.oldRange, obj.newText);
        passwordModel.buffer.setTextInRange(obj.newRange, '*'.repeat(obj.newText.length));

        if (self.configArray.length !== 0 && !self.disableEventhandler) {
          let index = self.selectServer.selectedOptions[0].value;
          self.configArray[index].password = passwordModel.clearTextPassword.getText()
            .trim();
        }

        changing = false;
      }
    });

    self.sftpInput.addEventListener('change', (event) => {
      if (self.configArray.length !== 0 && !self.disableEventhandler) {
        let index = self.selectServer.selectedOptions[0].value;
        self.configArray[index].sftp = self.sftpInput.checked;

        if (self.sftpInput.checked) {
          self.privatekeyfileControl.removeAttribute("style");
        } else {
          self.privatekeyfileControl.setAttribute("style", "display:none;");
        }
      }
    });
    self.privatekeyfileInput.getModel()
      .onDidChange(() => {
        if (self.configArray.length !== 0 && !self.disableEventhandler) {
          let index = self.selectServer.selectedOptions[0].value;
          self.configArray[index].privatekeyfile = self.privatekeyfileInput.getText()
            .trim();
        }
      });
    self.remoteInput.getModel()
      .onDidChange(() => {
        if (self.configArray.length !== 0 && !self.disableEventhandler) {
          let index = self.selectServer.selectedOptions[0].value;
          self.configArray[index].remote = self.remoteInput.getText()
            .trim();
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

    let duplicateButton = document.createElement('button');
    duplicateButton.textContent = 'Duplicate';
    duplicateButton.classList.add('btn');
    duplicateButton.classList.add('pull-right');

    // let testButton = document.createElement('button');
    // testButton.textContent = 'Test Connection';
    // testButton.classList.add('btn');
    // testButton.classList.add('pull-right');

    div.appendChild(selectContainer);
    selectContainer.appendChild(newButton);
    selectContainer.appendChild(deleteButton);
    selectContainer.appendChild(duplicateButton);

    // Events
    select.addEventListener('change', (event) => {
      if (self.configArray.length !== 0 && !self.disableEventhandler) {
        let option = event.currentTarget.selectedOptions[0];
        let indexInArray = option.value;

        self.nameInput.setText(self.configArray[indexInArray].name ? self.configArray[indexInArray].name : self.configArray[indexInArray].host);
        self.hostInput.setText(self.configArray[indexInArray].host);
        self.portInput.setText(self.configArray[indexInArray].port);
        self.userInput.setText(self.configArray[indexInArray].user);
        self.passwordInput.setText(self.configArray[indexInArray].password);
        self.sftpInput.checked = self.configArray[indexInArray].sftp;
        self.privatekeyfileInput.setText(self.configArray[indexInArray].privatekeyfile ? self.configArray[indexInArray].privatekeyfile : '');
        self.remoteInput.setText(self.configArray[indexInArray].remote ? self.configArray[indexInArray].remote : '/');

        if (self.sftpInput.checked) {
          self.privatekeyfileControl.removeAttribute("style");
        } else {
          self.privatekeyfileControl.setAttribute("style", "display:none;");
        }
      }
    });

    newButton.addEventListener('click', (event) => {
      self.new();
    });

    deleteButton.addEventListener('click', (event) => {
      self.delete();
    });

    duplicateButton.addEventListener('click', (event) => {
      self.duplicate();
    });

    div.classList.add('controls');

    return div;
  }

  loadConfig(loadConfig) {
    const self = this;

    let configText = atom.config.get('ftp-remote-edit.config');
    let configArray = [];

    // Debug
    // Load test config file
    // if (FileSystem.existsSync(debugConfig)) {
    //   configText = FileSystem.readFileSync(debugConfig, 'utf8');
    // }

    if (configText) {
      try {
        configText = JSON.stringify(JSON.parse(cleanJsonString(configText)), null, 4);
      } catch (e) {
        configText = decrypt(self.password, configText);
      }

      try {
        configArray = JSON.parse(cleanJsonString(configText));
        configArray.forEach((item, index) => {
          let cleanconfig = JSON.parse(JSON.stringify(config));
          if (!item.name) item.name = cleanconfig.name + " " + (index + 1);
          if (!item.host) item.host = cleanconfig.host;
          if (!item.port) item.port = cleanconfig.port;
          if (!item.user) item.user = cleanconfig.user;
          if (!item.password) item.password = cleanconfig.password;
          if (!item.sftp) item.sftp = cleanconfig.sftp;
          if (!item.privatekeyfile) item.privatekeyfile = cleanconfig.privatekeyfile;
          if (!item.remote) item.remote = cleanconfig.remote;
        });

        let sortServerProfilesByName = atom.config.get('ftp-remote-edit.tree.sortServerProfilesByName');
        configArray.sort((a, b) => {
          if (sortServerProfilesByName) {
            if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
            if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
          } else {
            if (a.host < b.host) return -1;
            if (a.host > b.host) return 1;
          }
          return 0;
        });
      } catch (e) {
        throwErrorIssue44(e, self.password);
        self.close();
      }
    }

    return configArray;
  }

  reload(loadConfig, selectedServer) {
    const self = this;

    if (!self.password) {
      return;
    }

    self.disableEventhandler = true;

    if (self.selectServer.options.length > 0) {
      for (i = self.selectServer.options.length - 1; i >= 0; i--) {
        self.selectServer.remove(i);
      }
    }

    // Load config
    if (loadConfig) {
      self.configArray = self.loadConfig();
    }

    let selectedIndex = 0;
    if (self.configArray.length !== 0) {
      self.configArray.forEach((item, index) => {
        let option = document.createElement("option");
        option.text = item.name;
        option.value = index;
        self.selectServer.add(option);

        if (selectedServer) {
          if (selectedServer.config.host == item.host && selectedServer.config.name == item.name) {
            selectedIndex = index;
          }
        }
      });

      self.selectServer.selectedIndex = selectedIndex;
      self.nameInput.setText(self.configArray[selectedIndex].name ? self.configArray[selectedIndex].name : self.configArray[selectedIndex].host);
      self.hostInput.setText(self.configArray[selectedIndex].host);
      self.portInput.setText(self.configArray[selectedIndex].port);
      self.userInput.setText(self.configArray[selectedIndex].user);
      self.passwordInput.setText(self.configArray[selectedIndex].password);
      self.sftpInput.checked = self.configArray[selectedIndex].sftp;
      self.privatekeyfileInput.setText(self.configArray[selectedIndex].privatekeyfile ? self.configArray[selectedIndex].privatekeyfile : '');
      self.remoteInput.setText(self.configArray[selectedIndex].remote ? self.configArray[selectedIndex].remote : '/');

      if (self.sftpInput.checked) {
        self.privatekeyfileControl.removeAttribute("style");
      } else {
        self.privatekeyfileControl.setAttribute("style", "display:none;");
      }

      // Enable Input Fields
      self.enableInputFields();
    } else {
      self.nameInput.setText('');
      self.hostInput.setText('');
      self.portInput.setText('');
      self.userInput.setText('');
      self.passwordInput.setText('');
      self.sftpInput.checked = false;
      self.privatekeyfileInput.setText('');
      self.remoteInput.setText('');
      self.privatekeyfileControl.setAttribute("style", "display:none;");

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

    self.nameInput[0].classList.remove('disabled');
    self.nameInput.disabled = false;

    self.hostInput[0].classList.remove('disabled');
    self.hostInput.disabled = false;

    self.portInput[0].classList.remove('disabled');
    self.portInput.disabled = false;

    self.userInput[0].classList.remove('disabled');
    self.userInput.disabled = false;

    self.passwordInput[0].classList.remove('disabled');
    self.passwordInput.disabled = false;

    self.privatekeyfileInput[0].classList.remove('disabled');
    self.privatekeyfileInput.disabled = false;

    self.remoteInput[0].classList.remove('disabled');
    self.remoteInput.disabled = false;
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

    self.privatekeyfileInput[0].classList.add('disabled');
    self.privatekeyfileInput.disabled = true;

    self.remoteInput[0].classList.add('disabled');
    self.remoteInput.disabled = true;

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
    self.privatekeyfileInput.getModel()
      .onDidChange(() => {
        if (!changing && self.privatekeyfileInput.disabled) {
          changing = true;
          self.privatekeyfileInput.setText('');
          changing = false;
        }
      });
    self.remoteInput.getModel()
      .onDidChange(() => {
        if (!changing && self.remoteInput.disabled) {
          changing = true;
          self.remoteInput.setText('');
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

  duplicate() {
    const self = this;

    if (self.configArray.length == 0) return;

    let index = self.selectServer.selectedOptions[0].value;

    self.enableInputFields();

    let newconfig = JSON.parse(JSON.stringify(self.configArray[index]));
    newconfig.name = newconfig.name + " " + (self.configArray.length + 1);
    self.configArray.push(newconfig);

    let option = document.createElement('option');
    option.text = newconfig.name;
    option.value = self.configArray.length - 1;

    this.selectServer.add(option);
    this.selectServer.value = self.configArray.length - 1;
    this.selectServer.dispatchEvent(new Event('change'));
  }
}
