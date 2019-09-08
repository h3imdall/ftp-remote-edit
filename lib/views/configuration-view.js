'use babel';

import { $, View, TextEditorView } from 'atom-space-pen-views';
import { TextBuffer, CompositeDisposable } from 'atom';
import { showMessage } from './../helper/helper.js';
import Connector from './../connectors/connector.js';
import Import from './../helper/import.js';
import FolderConfigurationView from './../views/folder-configuration-view';

const atom = global.atom;
const config = require('./../config/server-schema.json');
const debugConfig = __dirname + './../config/server-test-schema.json';
const Storage = require('./../helper/storage.js');
const Extend = require('util')._extend;

export default class ConfigurationView extends View {

  static content() {
    return this.div({
      class: 'ftp-remote-edit settings-view overlay from-top'
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
            outlet: 'content',
          });
          this.div({
            class: 'panels-footer',
            outlet: 'footer',
          });
        });
      });
      this.div({
        class: 'error-message',
        outlet: 'error',
      });
    });
  }

  initialize() {
    const self = this;

    self.subscriptions = null;
    self.disableEventhandler = false;

    let html = '<p>Ftp-Remote-Edit Server Settings</p>';
    html += "<p>You can edit each connection at the time. All changes will only be saved by pushing the save button.</p>";
    self.info.html(html);

    self.saveButton = document.createElement('button');
    self.saveButton.textContent = 'Save';
    self.saveButton.classList.add('btn');

    self.importButton = document.createElement('button');
    self.importButton.textContent = 'Import';
    self.importButton.classList.add('btn');

    self.closeButton = document.createElement('button');
    self.closeButton.textContent = 'Cancel';
    self.closeButton.classList.add('btn');
    self.closeButton.classList.add('pull-right');

    self.content.append(self.createServerSelect());
    self.content.append(self.createControls());

    self.footer.append(self.saveButton);
    self.footer.append(self.importButton);
    self.footer.append(self.closeButton);

    // Events
    self.closeButton.addEventListener('click', (event) => {
      self.close();
    });

    self.saveButton.addEventListener('click', (event) => {
      if (self.selectedServer.temp) {
        self.selectedServerView.initialize(self.selectedServer);

      } else {
        self.save();
      }
      self.close();
    });

    self.importButton.addEventListener('click', (event) => {
      self.import();
    });

    self.subscriptions = new CompositeDisposable();
    self.subscriptions.add(atom.commands.add(this.element, {
      'core:confirm': () => {
        // self.save();
      },
      'core:cancel': () => {
        self.cancel();
      },
    }));

    // Handle keydown by tab events to switch between fields
    self.closeButton.addEventListener('keydown', (event) => {
      if (event.key == 'Tab') {
        event.preventDefault();
        self.selectServer.focus();
      }
    });
  }

  constructor() {
    super();
    const self = this;
    self.selectedServerView = null;
    if (Storage.getServers().length !== 0) {
      self.selectedServer = Storage.getServers()[0];
    } else {
      self.selectedServer = null;
    }
  }

  destroy() {
    const self = this;

    if (self.subscriptions) {
      self.subscriptions.dispose();
      self.subscriptions = null;
    }
  }

  createControls() {
    const self = this;

    let divRequired = document.createElement('div');
    divRequired.classList.add('server-settings');

    let nameLabel = document.createElement('label');
    nameLabel.classList.add('control-label');
    let nameLabelTitle = document.createElement('div');
    nameLabelTitle.textContent = 'The name of the server.';
    nameLabelTitle.classList.add('setting-title');
    nameLabel.appendChild(nameLabelTitle);
    self.nameInput = new TextEditorView({ mini: true, placeholderText: "name" });
    self.nameInput.element.classList.add('form-control');

    self.folderLabel = document.createElement('label');
    self.folderLabel.classList.add('control-label');
    let folderLabelTitle = document.createElement('div');
    folderLabelTitle.textContent = 'Folder';
    folderLabelTitle.classList.add('setting-title');
    self.folderLabel.appendChild(folderLabelTitle);

    self.folderSelect = document.createElement('select');
    self.folderSelect.classList.add('form-control');
    self.createControlsFolderSelect();

    self.folderEdit = document.createElement('button');
    self.folderEdit.textContent = 'Edit';
    self.folderEdit.classList.add('btn');

    let hostLabel = document.createElement('label');
    hostLabel.classList.add('control-label');
    let hostLabelTitle = document.createElement('div');
    hostLabelTitle.textContent = 'The hostname or IP address of the server.';
    hostLabelTitle.classList.add('setting-title');
    hostLabel.appendChild(hostLabelTitle);
    self.hostInput = new TextEditorView({ mini: true, placeholderText: "localhost" });
    self.hostInput.element.classList.add('form-control');

    let portLabel = document.createElement('label');
    portLabel.classList.add('control-label');
    let portLabelTitle = document.createElement('div');
    portLabelTitle.textContent = 'Port';
    portLabelTitle.classList.add('setting-title');
    portLabel.appendChild(portLabelTitle);
    self.portInput = new TextEditorView({ mini: true, placeholderText: "21" });
    self.portInput.element.classList.add('form-control');

    let protocolLabel = document.createElement('label');
    protocolLabel.classList.add('control-label');
    let protocolLabelTitle = document.createElement('div');
    protocolLabelTitle.textContent = 'Protocol';
    protocolLabelTitle.classList.add('setting-title');
    protocolLabel.appendChild(protocolLabelTitle);

    self.protocolSelect = document.createElement('select');
    self.protocolSelect.classList.add('form-control');
    let optionFTP = document.createElement("option");
    optionFTP.text = 'FTP - File Transfer Protocol';
    optionFTP.value = 'ftp';
    self.protocolSelect.add(optionFTP);
    let optionSFTP = document.createElement("option");
    optionSFTP.text = 'SFTP - SSH File Transfer Protocol';
    optionSFTP.value = 'sftp';
    self.protocolSelect.add(optionSFTP);
    let protocolSelectContainer = document.createElement('div');
    protocolSelectContainer.classList.add('select-container');
    protocolSelectContainer.appendChild(self.protocolSelect);

    let protocolEncryptionLabel = document.createElement('label');
    protocolEncryptionLabel.classList.add('control-label');
    let protocolEncryptionLabelTitle = document.createElement('div');
    protocolEncryptionLabelTitle.textContent = 'Encryption';
    protocolEncryptionLabelTitle.classList.add('setting-title');
    protocolEncryptionLabel.appendChild(protocolEncryptionLabelTitle);

    self.protocolEncryptionSelect = document.createElement('select');
    self.protocolEncryptionSelect.classList.add('form-control');
    let optionPlainFTP = document.createElement("option");
    optionPlainFTP.text = 'Only use plain FTP (insecure)';
    optionPlainFTP.value = 'none';
    self.protocolEncryptionSelect.add(optionPlainFTP);
    let optionExplicitSFTP = document.createElement("option");
    optionExplicitSFTP.text = 'Require explicit FTP over TLS';
    optionExplicitSFTP.value = 'explicit';
    self.protocolEncryptionSelect.add(optionExplicitSFTP);
    let optionImplicitSFTP = document.createElement("option");
    optionImplicitSFTP.text = 'Require implicit FTP over TLS (not implemented)';
    optionImplicitSFTP.value = 'implicit';
    optionImplicitSFTP.disabled = true;
    self.protocolEncryptionSelect.add(optionImplicitSFTP);
    let protocolEncryptionSelectContainer = document.createElement('div');
    protocolEncryptionSelectContainer.classList.add('select-container');
    protocolEncryptionSelectContainer.appendChild(self.protocolEncryptionSelect);

    let logonTypeLabel = document.createElement('label');
    logonTypeLabel.classList.add('control-label');
    let logonTypeLabelTitle = document.createElement('div');
    logonTypeLabelTitle.textContent = 'Logon Type';
    logonTypeLabelTitle.classList.add('setting-title');
    logonTypeLabel.appendChild(logonTypeLabelTitle);

    self.logonTypeSelect = document.createElement('select');
    self.logonTypeSelect.classList.add('form-control');
    let optionNormal = document.createElement("option");
    optionNormal.text = 'Username / Password';
    optionNormal.value = 'credentials';
    self.logonTypeSelect.add(optionNormal);
    let optionKeyFile = document.createElement("option");
    optionKeyFile.text = 'Keyfile (OpenSSH format - PEM)';
    optionKeyFile.value = 'keyfile';
    self.logonTypeSelect.add(optionKeyFile);
    let optionAgent = document.createElement("option");
    optionAgent.text = 'SSH Agent';
    optionAgent.value = 'agent';
    self.logonTypeSelect.add(optionAgent);
    let logonTypeSelectContainer = document.createElement('div');
    logonTypeSelectContainer.classList.add('select-container');
    logonTypeSelectContainer.appendChild(self.logonTypeSelect);

    let userLabel = document.createElement('label');
    userLabel.classList.add('control-label');
    let userLabelTitle = document.createElement('div');
    userLabelTitle.textContent = `Username for authentication.`;
    userLabelTitle.classList.add('setting-title');
    userLabel.appendChild(userLabelTitle);
    self.userInput = new TextEditorView({ mini: true, placeholderText: "username" });
    self.userInput.element.classList.add('form-control');

    let passwordLabel = document.createElement('label');
    passwordLabel.classList.add('control-label');
    let passwordLabelTitle = document.createElement('div');
    passwordLabelTitle.textContent = `Password/Passphrase for authentication.`;
    passwordLabelTitle.classList.add('setting-title');
    passwordLabel.appendChild(passwordLabelTitle);
    self.passwordInput = new TextEditorView({ mini: true, placeholderText: "password" });
    self.passwordInput.element.classList.add('form-control');

    let privatekeyfileLabel = document.createElement('label');
    privatekeyfileLabel.classList.add('control-label');
    let privatekeyfileLabelTitle = document.createElement('div');
    privatekeyfileLabelTitle.textContent = `Path to private keyfile.`;
    privatekeyfileLabelTitle.classList.add('setting-title');
    privatekeyfileLabel.appendChild(privatekeyfileLabelTitle);
    self.privatekeyfileInput = new TextEditorView({ mini: true, placeholderText: "path to private keyfile" });
    self.privatekeyfileInput.element.classList.add('form-control');

    let remoteLabel = document.createElement('label');
    remoteLabel.classList.add('control-label');
    let remoteLabelTitle = document.createElement('div');
    remoteLabelTitle.textContent = `Initial Directory.`;
    remoteLabelTitle.classList.add('setting-title');
    remoteLabel.appendChild(remoteLabelTitle);
    self.remoteInput = new TextEditorView({ mini: true, placeholderText: "/" });
    self.remoteInput.element.classList.add('form-control');

    let nameControl = document.createElement('div');
    nameControl.classList.add('controls');
    nameControl.classList.add('name');
    nameControl.appendChild(nameLabel);
    nameControl.appendChild(self.nameInput.element);

    let folderControl = document.createElement('div');
    folderControl.classList.add('controls');
    folderControl.classList.add('folder');
    folderControl.appendChild(self.folderLabel);
    folderControl.appendChild(self.folderSelect);

    let folderButtonControl = document.createElement('div');
    folderButtonControl.classList.add('controls');
    folderButtonControl.classList.add('folder-button');
    folderButtonControl.appendChild(self.folderEdit);

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

    let protocolControl = document.createElement('div');
    protocolControl.classList.add('controls');
    protocolControl.classList.add('protocol');
    protocolControl.appendChild(protocolLabel);
    protocolControl.appendChild(protocolSelectContainer);

    self.protocolEncryptionControl = document.createElement('div');
    self.protocolEncryptionControl.classList.add('controls');
    self.protocolEncryptionControl.classList.add('protocol-encryption');
    self.protocolEncryptionControl.appendChild(protocolEncryptionLabel);
    self.protocolEncryptionControl.appendChild(protocolEncryptionSelectContainer);

    let logonTypeControl = document.createElement('div');
    logonTypeControl.classList.add('controls');
    logonTypeControl.classList.add('protocol');
    logonTypeControl.appendChild(logonTypeLabel);
    logonTypeControl.appendChild(logonTypeSelectContainer);

    let nameGroup = document.createElement('div');
    nameGroup.classList.add('control-group');
    nameGroup.appendChild(nameControl);
    nameGroup.appendChild(folderControl);
    nameGroup.appendChild(folderButtonControl);
    divRequired.appendChild(nameGroup);

    let hostGroup = document.createElement('div');
    hostGroup.classList.add('control-group');
    hostGroup.appendChild(hostControl);
    hostGroup.appendChild(portControl);
    divRequired.appendChild(hostGroup);

    let protocolGroup = document.createElement('div');
    protocolGroup.classList.add('control-group');
    protocolGroup.appendChild(protocolControl);
    protocolGroup.appendChild(self.protocolEncryptionControl);
    protocolGroup.appendChild(logonTypeControl);
    divRequired.appendChild(protocolGroup);

    let usernameControl = document.createElement('div');
    usernameControl.classList.add('controls');
    usernameControl.classList.add('username');
    usernameControl.appendChild(userLabel);
    usernameControl.appendChild(self.userInput.element);

    self.passwordControl = document.createElement('div');
    self.passwordControl.classList.add('controls');
    self.passwordControl.classList.add('password');
    self.passwordControl.appendChild(passwordLabel);
    self.passwordControl.appendChild(self.passwordInput.element);

    let credentialGroup = document.createElement('div');
    credentialGroup.classList.add('control-group');
    credentialGroup.appendChild(usernameControl);
    credentialGroup.appendChild(self.passwordControl);
    divRequired.appendChild(credentialGroup);

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
    self.nameInput.getModel().onDidChange(() => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        self.selectedServer.name = self.nameInput.getText().trim();
        if (!self.serverControl.classList.contains('hidden')) {
          self.selectServer.selectedOptions[0].text = self.nameInput.getText().trim();
        }
      }
    });
    self.hostInput.getModel().onDidChange(() => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        self.selectedServer.host = self.hostInput.getText().trim();
      }
    });
    self.portInput.getModel().onDidChange(() => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        self.selectedServer.port = self.portInput.getText().trim();
      }
    });

    self.folderSelect.addEventListener('change', (event) => {
      if (Storage.getFolders().length !== 0 && !self.disableEventhandler) {
        let option = event.currentTarget.selectedOptions[0];
        self.selectedServer.parent = parseInt(option.value);
      }
    });

    self.folderEdit.addEventListener('click', (event) => {
      self.editFolders();
    });

    self.protocolSelect.addEventListener('change', (event) => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        let option = event.currentTarget.selectedOptions[0];

        if (option.value == 'sftp') {
          self.selectedServer.sftp = true;
          self.selectedServer.secure = false;
        } else {
          self.selectedServer.logon = 'credentials';
          self.selectedServer.sftp = false;
          self.selectedServer.useAgent = false;
          self.selectedServer.privatekeyfile = '';
        }
        self.fillInputFields();
      }
    });

    self.protocolEncryptionSelect.addEventListener('change', (event) => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        let option = event.currentTarget.selectedOptions[0];

        if (option.value == 'explicit') {
          self.selectedServer.secure = true;
        } else if (option.value == 'implicit') {
          self.selectedServer.secure = 'implicit';
        } else {
          self.selectedServer.secure = false;
        }
        self.fillInputFields();
      }
    });

    self.logonTypeSelect.addEventListener('change', (event) => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        let option = event.currentTarget.selectedOptions[0];

        if (option.value == 'credentials') {
          self.selectedServer.logon = 'credentials';
          self.selectedServer.useAgent = false;
          self.selectedServer.privatekeyfile = '';
        } else if (option.value == 'keyfile') {
          self.selectedServer.logon = 'keyfile';
          self.selectedServer.useAgent = false;
        } else if (option.value == 'agent') {
          self.selectedServer.logon = 'agent';
          self.selectedServer.useAgent = true;
          self.selectedServer.privatekeyfile = '';
          self.selectedServer.password = '';
        } else {
          self.selectedServer.useAgent = false;
        }
        self.fillInputFields();
      }
    });

    self.userInput.getModel().onDidChange(() => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        self.selectedServer.user = self.userInput.getText().trim();
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

        if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
          self.selectedServer.password = passwordModel.clearTextPassword.getText().trim();
        }

        changing = false;
      }
    });

    self.privatekeyfileInput.getModel().onDidChange(() => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        self.selectedServer.privatekeyfile = self.privatekeyfileInput.getText().trim();
      }
    });
    self.remoteInput.getModel().onDidChange(() => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        self.selectedServer.remote = self.remoteInput.getText().trim();
      }
    });

    // Handle keydown by tab events to switch between fields
    self.nameInput.getModel().getElement().addEventListener('keydown', (event) => {
      if (event.key == 'Tab') {
        event.preventDefault();
        $(self.folderSelect).focus();
      }
    });

    self.folderSelect.addEventListener('keydown', (event) => {
      if (event.key == 'Tab') {
        event.preventDefault();
        self.hostInput.focus();
      }
    });

    self.hostInput.getModel().getElement().addEventListener('keydown', (event) => {
      if (event.key == 'Tab') {
        event.preventDefault();
        self.portInput.focus();
      }
    });

    self.logonTypeSelect.addEventListener('keydown', (event) => {
      if (event.key == 'Tab') {
        event.preventDefault();
        self.userInput.focus();
      }
    });

    self.userInput.getModel().getElement().addEventListener('keydown', (event) => {
      if (event.key == 'Tab') {
        event.preventDefault();
        if (Storage.getServers().length !== 0) {
          const option = self.logonTypeSelect.selectedOptions[0].value;
          if (option == 'credentials') {
            self.passwordInput.focus();
          } else if (option == 'keyfile') {
            self.passwordInput.focus();
          } else if (option == 'agent') {
            self.remoteInput.focus();
          }
        }
      }
    });

    self.passwordInput.getModel().getElement().addEventListener('keydown', (event) => {
      if (event.key == 'Tab') {
        event.preventDefault();
        if (Storage.getServers().length !== 0) {
          const option = self.logonTypeSelect.selectedOptions[0].value;
          if (option == 'credentials') {
            self.remoteInput.focus();
          } else if (option == 'keyfile') {
            self.privatekeyfileInput.focus();
          } else if (option == 'agent') {
            self.remoteInput.focus();
          }
        }
      }
    });

    self.privatekeyfileInput.getModel().getElement().addEventListener('keydown', (event) => {
      if (event.key == 'Tab') {
        event.preventDefault();
        self.remoteInput.focus();
      }
    });

    return divRequired;
  }

  createControlsFolderSelect() {
    const self = this;

    let selected_value = self.folderSelect.value;

    while (self.folderSelect.firstChild) {
      self.folderSelect.removeChild(self.folderSelect.firstChild);
    }

    let optionNone = document.createElement("option");
    optionNone.text = '- None -';
    optionNone.value = null;
    self.folderSelect.add(optionNone);

    Storage.getFoldersStructuredByTree().forEach((config) => {
      let folder_option = document.createElement("option");
      folder_option.text = config.name;
      folder_option.value = config.id;
      self.folderSelect.add(folder_option);
    });

    self.folderSelect.value = selected_value;
  }

  createServerSelect() {
    const self = this;

    self.serverGroupContainer = document.createElement('div');
    self.serverGroupContainer.classList.add('server');
    self.serverGroupContainer.style.marginBottom = '20px';

    let select = document.createElement('select');
    select.classList.add('form-control');
    self.selectServer = select;
    self.selectServer.focus();

    self.serverControl = document.createElement('div');
    self.serverControl.classList.add('controls');
    self.serverControl.classList.add('server');
    self.serverControl.appendChild(self.selectServer);

    self.newButton = document.createElement('button');
    self.newButton.textContent = 'New';
    self.newButton.classList.add('btn');

    self.deleteButton = document.createElement('button');
    self.deleteButton.textContent = 'Delete';
    self.deleteButton.classList.add('btn');

    self.duplicateButton = document.createElement('button');
    self.duplicateButton.textContent = 'Duplicate';
    self.duplicateButton.classList.add('btn');

    self.testButton = document.createElement('button');
    self.testButton.textContent = 'Test';
    self.testButton.classList.add('btn');

    let buttonControl = document.createElement('div');
    buttonControl.classList.add('controls');
    buttonControl.classList.add('server-button');
    buttonControl.appendChild(self.newButton);
    buttonControl.appendChild(self.deleteButton);
    buttonControl.appendChild(self.duplicateButton);
    buttonControl.appendChild(self.testButton);

    let serverGroup = document.createElement('div');
    serverGroup.classList.add('control-group');
    serverGroup.appendChild(self.serverControl);
    serverGroup.appendChild(buttonControl);

    self.serverGroupContainer.appendChild(serverGroup);

    // Events
    select.addEventListener('change', (event) => {
      if (Storage.getServers().length !== 0 && !self.disableEventhandler) {
        let option = event.currentTarget.selectedOptions[0];
        let indexInArray = option.value;
        if (indexInArray) {
          self.selectedServer = Storage.getServers()[indexInArray];
        }
        self.fillInputFields();
      }
    });

    self.newButton.addEventListener('click', (event) => {
      self.new();
    });

    self.deleteButton.addEventListener('click', (event) => {
      self.delete();
    });

    self.duplicateButton.addEventListener('click', (event) => {
      self.duplicate();
    });

    self.testButton.addEventListener('click', (event) => {
      self.test();
    });

    // Handle keydown by tab events to switch between fields
    self.testButton.addEventListener('keydown', (event) => {
      if (event.key == 'Tab') {
        event.preventDefault();
        self.nameInput.focus();
      }
    });

    return self.serverGroupContainer;
  }

  reload(selectedServer = null) {
    const self = this;

    self.disableEventhandler = true;
    self.selectedServerView = null;

    self.createControlsFolderSelect();

    while (self.selectServer.firstChild) {
      self.selectServer.removeChild(self.selectServer.firstChild);
    }

    if (selectedServer.config.temp) {
      self.hideInputFieldsForTemp();
      self.selectedServerView = selectedServer;
      self.selectedServer = Extend({}, self.selectedServerView.config);
      self.fillInputFields();
      // Enable Input Fields
      self.enableInputFields();
    } else if (Storage.getServers().length !== 0) {
      self.showInputFieldsForStorage();

      self.selectedServer = Storage.getServers()[0];
      self.selectServer.selectedIndex = 0;

      Storage.getServers().forEach((item, index) => {
        let option = document.createElement("option");
        option.text = item.name;
        option.value = index;
        self.selectServer.add(option);

        if (selectedServer && typeof selectedServer.config !== 'undefined' && selectedServer.config.host !== 'undefined') {
          if (selectedServer.config.host == item.host && selectedServer.config.name == item.name) {
            self.selectedServer = item;
            self.selectServer.selectedIndex = index;
          }
        }
      });
      self.fillInputFields();
      // Enable Input Fields
      self.enableInputFields();
    } else {
      self.showInputFieldsForStorage();
      self.fillInputFields();
      // Disable Input Fields
      self.disableInputFields();
    }
    self.disableEventhandler = false;
  }

  attach() {
    const self = this;

    self.panel = atom.workspace.addModalPanel({
      item: self
    });

    // Resize content to fit on smaller displays
    let body = document.body.offsetHeight;
    let content = self.panel.element.offsetHeight;
    let offset = $(self.panel.element).position().top;

    if (content + (2 * offset) > body) {
      let settings = self.content.find('.server-settings')[0];
      let height = (2 * offset) + content - body;
      $(settings).height($(settings).height() - height);
    }
  }

  close() {
    const self = this;

    const destroyPanel = this.panel;
    this.panel = null;
    if (destroyPanel) {
      destroyPanel.destroy();
    }

    Storage.load(true);

    atom.workspace.getActivePane().activate();
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

  fillInputFields() {
    const self = this;

    let server = self.selectedServer;

    self.disableEventhandler = true;

    if (server) {
      self.nameInput.setText(server.name ? server.name : server.host);
      self.hostInput.setText(server.host);
      self.portInput.setText(server.port);
      if (Storage.getFolder(server.parent)) {
        self.folderSelect.value = Storage.getFolder(server.parent).id;
      } else {
        self.folderSelect.value = 'null';
      }

      if (server.sftp) {
        self.protocolSelect.selectedIndex = 1;
        self.portInput.element.setAttribute('placeholder-text', '22');

        self.protocolEncryptionSelect.selectedIndex = 0;

        self.logonTypeSelect.options[1].disabled = false;
        self.logonTypeSelect.options[2].disabled = false;

        self.protocolEncryptionControl.setAttribute("style", "display:none;");
      } else {
        self.protocolSelect.selectedIndex = 0;

        if (server.secure === 'implicit') {
          self.protocolEncryptionSelect.selectedIndex = 2;
          self.portInput.element.setAttribute('placeholder-text', '990');
        } else if (server.secure === true) {
          self.protocolEncryptionSelect.selectedIndex = 1;
          self.portInput.element.setAttribute('placeholder-text', '21');
        } else {
          self.protocolEncryptionSelect.selectedIndex = 0;
          self.portInput.element.setAttribute('placeholder-text', '21');
        }

        self.logonTypeSelect.selectedIndex = 0; // Username/Password
        self.logonTypeSelect.options[1].disabled = true;
        self.logonTypeSelect.options[2].disabled = true;

        self.protocolEncryptionControl.removeAttribute("style");
      }

      if (server.logon == 'keyfile') {
        self.logonTypeSelect.selectedIndex = 1; // Keyfile
        self.passwordControl.removeAttribute("style");
        self.privatekeyfileControl.removeAttribute("style");
      } else if (server.logon == 'agent') {
        self.logonTypeSelect.selectedIndex = 2; // SSH Agent
        self.passwordControl.setAttribute("style", "display:none;");
        self.privatekeyfileControl.setAttribute("style", "display:none;");
      } else {
        self.logonTypeSelect.selectedIndex = 0; // Username/Password
        self.passwordControl.removeAttribute("style");
        self.privatekeyfileControl.setAttribute("style", "display:none;");
      }

      self.userInput.setText(server.user);
      self.passwordInput.setText(server.password);
      self.privatekeyfileInput.setText(server.privatekeyfile ? server.privatekeyfile : '');
      self.remoteInput.setText(server.remote ? server.remote : '/');
    } else {
      self.nameInput.setText('');
      self.hostInput.setText('');
      self.portInput.setText('');

      self.protocolSelect.selectedIndex = 0;
      self.protocolEncryptionSelect.selectedIndex = 0;
      self.logonTypeSelect.selectedIndex = 0;

      self.userInput.setText('');
      self.passwordInput.setText('');
      self.privatekeyfileInput.setText('');
      self.remoteInput.setText('');

      self.privatekeyfileControl.setAttribute("style", "display:none;");
    }

    self.disableEventhandler = false;
  }

  enableInputFields() {
    const self = this;

    self.deleteButton.classList.remove('disabled');
    self.deleteButton.disabled = false;

    self.duplicateButton.classList.remove('disabled');
    self.duplicateButton.disabled = false;

    self.testButton.classList.remove('disabled');
    self.testButton.disabled = false;

    self.nameInput[0].classList.remove('disabled');
    self.nameInput.disabled = false;

    self.folderSelect.classList.remove('disabled');
    self.folderSelect.disabled = false;

    self.hostInput[0].classList.remove('disabled');
    self.hostInput.disabled = false;

    self.portInput[0].classList.remove('disabled');
    self.portInput.disabled = false;

    self.protocolSelect.classList.remove('disabled');
    self.protocolSelect.disabled = false;

    self.logonTypeSelect.classList.remove('disabled');
    self.logonTypeSelect.disabled = false;

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

    self.deleteButton.classList.add('disabled');
    self.deleteButton.disabled = true;

    self.duplicateButton.classList.add('disabled');
    self.duplicateButton.disabled = true;

    self.testButton.classList.add('disabled');
    self.testButton.disabled = true;

    self.nameInput[0].classList.add('disabled');
    self.nameInput.disabled = true;

    self.folderSelect.classList.add('disabled');
    self.folderSelect.disabled = true;

    self.hostInput[0].classList.add('disabled');
    self.hostInput.disabled = true;

    self.portInput[0].classList.add('disabled');
    self.portInput.disabled = true;

    self.protocolSelect.classList.add('disabled');
    self.protocolSelect.disabled = true;

    self.logonTypeSelect.classList.add('disabled');
    self.logonTypeSelect.disabled = true;

    self.userInput[0].classList.add('disabled');
    self.userInput.disabled = true;

    self.passwordInput[0].classList.add('disabled');
    self.passwordInput.disabled = true;

    self.privatekeyfileInput[0].classList.add('disabled');
    self.privatekeyfileInput.disabled = true;

    self.remoteInput[0].classList.add('disabled');
    self.remoteInput.disabled = true;

    let changing = false;
    self.nameInput.getModel().onDidChange(() => {
      if (!changing && self.nameInput.disabled) {
        changing = true;
        self.nameInput.setText('');
        changing = false;
      }
    });
    self.hostInput.getModel().onDidChange(() => {
      if (!changing && self.hostInput.disabled) {
        changing = true;
        self.hostInput.setText('');
        changing = false;
      }
    });
    self.portInput.getModel().onDidChange(() => {
      if (!changing && self.portInput.disabled) {
        changing = true;
        self.portInput.setText('');
        changing = false;
      }
    });
    self.userInput.getModel().onDidChange(() => {
      if (!changing && self.userInput.disabled) {
        changing = true;
        self.userInput.setText('');
        changing = false;
      }
    });
    self.passwordInput.getModel().onDidChange(() => {
      if (!changing && self.passwordInput.disabled) {
        changing = true;
        self.passwordInput.setText('');
        changing = false;
      }
    });
    self.privatekeyfileInput.getModel().onDidChange(() => {
      if (!changing && self.privatekeyfileInput.disabled) {
        changing = true;
        self.privatekeyfileInput.setText('');
        changing = false;
      }
    });
    self.remoteInput.getModel().onDidChange(() => {
      if (!changing && self.remoteInput.disabled) {
        changing = true;
        self.remoteInput.setText('');
        changing = false;
      }
    });
  }

  hideInputFieldsForTemp() {
    const self = this;

    self.serverGroupContainer.classList.add('hidden');
    self.serverControl.classList.add('hidden');
    self.newButton.classList.add('hidden');
    self.deleteButton.classList.add('hidden');
    self.testButton.classList.add('hidden');
    self.importButton.classList.add('hidden');
    self.duplicateButton.classList.add('hidden');
    self.folderLabel.classList.add('hidden');
    self.folderSelect.classList.add('hidden');
    self.folderEdit.classList.add('hidden');
  }

  showInputFieldsForStorage() {
    const self = this;

    self.serverGroupContainer.classList.remove('hidden');
    self.serverControl.classList.remove('hidden');
    self.newButton.classList.remove('hidden');
    self.deleteButton.classList.remove('hidden');
    self.testButton.classList.remove('hidden');
    self.importButton.classList.remove('hidden');
    self.duplicateButton.classList.remove('hidden');
    self.folderLabel.classList.remove('hidden');
    self.folderSelect.classList.remove('hidden');
    self.folderEdit.classList.remove('hidden');
  }

  test() {
    const self = this;

    if (Storage.getServers().length == 0) return;

    try {
      const config = JSON.parse(JSON.stringify(Storage.getServers()[selectedIndex]));

      const connector = new Connector(config);

      connector.on('debug', (cmd, param1, param2) => {
        if (atom.config.get('ftp-remote-edit.dev.debug')) {
          if (param1 && param2) {
            console.log(cmd, param1, param2);
          } else if (param1) {
            console.log(cmd, param1);
          } else if (cmd) console.log(cmd);
        }
      });

      connector.connect().then(() => {
        showMessage('Connection could be established successfully')
        connector.disconnect(null).catch(() => {});
        connector.destroy();
      }).catch((err) => {
        showMessage(err, 'error');
        connector.disconnect(null).catch(() => {});
        connector.destroy();
      });
    } catch (e) {}
  }

  new() {
    const self = this;

    self.enableInputFields();

    let newconfig = JSON.parse(JSON.stringify(config));
    newconfig.name = config.name + " " + (Storage.getServers().length + 1);
    self.selectedServer = Storage.addServer(newconfig);

    let option = document.createElement('option');
    option.text = newconfig.name;
    option.value = Storage.getServers().length - 1;

    this.selectServer.add(option);
    this.selectServer.value = Storage.getServers().length - 1;
    this.selectServer.dispatchEvent(new Event('change'));
    self.nameInput.focus();
  }

  save() {
    const self = this;
    Storage.save();
    self.close();
  }

  delete() {
    const self = this;

    if (Storage.getServers().length == 0) return;

    let index = self.selectServer.selectedOptions[0].value;
    Storage.deleteServer(index);

    self.reload();
    self.selectServer.focus();
  }

  duplicate() {
    const self = this;

    if (Storage.getServers().length == 0) return;

    let index = self.selectServer.selectedOptions[0].value;

    self.enableInputFields();

    let newconfig = JSON.parse(JSON.stringify(self.selectedServer));
    newconfig.name = newconfig.name + " " + (Storage.getServers().length + 1);
    Storage.addServer(newconfig);

    let option = document.createElement('option');
    option.text = newconfig.name;
    option.value = Storage.getServers().length - 1;

    this.selectServer.add(option);
    this.selectServer.value = Storage.getServers().length - 1;
    this.selectServer.dispatchEvent(new Event('change'));
    self.nameInput.focus();
  }

  import() {
    const self = this;
    const importHandler = new Import();

    importHandler.onFinished = (statistic) => {
      let detail = [];

      if (statistic.createdServers) {
        detail.push(statistic.createdServers + " New Server(s)");
      }
      if (statistic.updatedServers) {
        detail.push(statistic.updatedServers + " Updated Server(s)");
      }
      if (statistic.createdFolders) {
        detail.push(statistic.createdFolders + " New Folder(s)");
      }

      atom.notifications.addSuccess('Import completed', {
        detail: 'Imported: ' + detail.join(', ') + '.',
        dismissable: true,
      });

      self.reload();
    };

    importHandler.onWarning = (error) => {
      // TODO
    };

    importHandler.onError = (error) => {
      atom.notifications.addError('An error occurred during import.', {
        detail: error.message,
        dismissable: true,
      });
    };

    importHandler.import();
  }

  editFolders() {
    const self = this;

    const folderConfigurationView = new FolderConfigurationView('', true);

    let index = self.folderSelect.selectedOptions[0].value;

    if (index > 0) {
      let folder = Storage.getFolder(index);
      folderConfigurationView.reload(folder);
    } else if (Storage.getFolders().length > 0) {
      let folder = Storage.getFolders()[0];
      folderConfigurationView.reload(folder);
    }

    folderConfigurationView.on('close', (e) => {
      self.createControlsFolderSelect();
      self.attach();
    });

    folderConfigurationView.attach();
  }
}
