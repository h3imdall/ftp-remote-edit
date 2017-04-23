'use babel';

import Secure from './Secure.js';
import Node from './Node.js';
import Ftp from './connectors/ftp.js';
import Sftp from './connectors/sftp.js';

import DirectoryView from './views/directory-view.js';
import FileView from './views/file-view.js';

import ConfigurationView from './views/configuration-view';
import TreeView from './views/tree-view';

import PromptPassDialog from './dialogs/prompt-pass-dialog.js';

import { CompositeDisposable, TextEditor } from 'atom';

const atom = global.atom;
const config = require('./config/config-schema.json');
const testserver = require('./config/server-test-schema.json');

class FtpRemoteEdit {

  constructor() {
    const self = this;
    self.info = [];
    self.config = config;
    self.testserver = testserver;
    self.listeners = [];
    self.treeView = null;
  }

  activate() {
    const self = this;

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    self.listeners = new CompositeDisposable();

    // Register command that toggles this view
    self.listeners.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:toggle': () => self.toggle(),
      'ftp-remote-edit:edit-servers': () => self.editServers(),
      'ftp-remote-edit:new-file': () => self.newFile(state),
      'ftp-remote-edit:new-directory': () => self.newDirectory(state),
      'ftp-remote-edit:delete-file': () => self.deleteFile(),
      'ftp-remote-edit:delete-directory': () => self.deleteDirectory(),
      'ftp-remote-edit:rename-file': () => self.rename('file'),
      'ftp-remote-edit:rename-directory': () => self.rename('directory')
    }));

    self.treeView = new TreeView();
    self.treeView.detach();

    // Events
    atom.config.onDidChange('ftp-remote-edit.reset', () => {
      self.treeView.detach();
    });
    atom.config.onDidChange('ftp-remote-edit.config', () => {
      if (this.isVisible()) {
        setTimeout(() => {
          self.treeView.detach();
          self.treeView.attach();
        }, 1);
      }
    });
  }

  deactivate() {
    const self = this;
    self.listeners.dispose();
    self.treeView.destroy();
  }

  serialize() {
    return {};
  }

  promtPassword(toggle) {
    const self = this;
    const dialog = new PromptPassDialog('', true);

    dialog.on('dialog-done', (e, password) => {
      if (self.checkPassword(password)) {
        self.setPassword(password);

        self.treeView.servers = self.getServers(password);
        self.treeView.reload();
        if (toggle) self.treeView.toggle();
        dialog.close();
      } else {
        dialog.showError('Wrong password, try again!');
      }
    });
    dialog.attach();
  }

  checkPassword(password) {
    let passwordHash = atom.config.get('ftp-remote-edit.password');
    if (!passwordHash) return true;

    let passwordReset = atom.config.get('ftp-remote-edit.reset');
    if (passwordReset) return true;

    let secure = new Secure();
    if (secure.checkPassword(password) === false) {
      return false;
    }

    return true;
  }

  setPassword(password) {
    const self = this;
    if (self.checkPassword(password)) {
      let secure = new Secure();
      let passwordHash = secure.encrypt(password, password);

      // Store in Session
      self.info.password = password;
      self.info.passwordHash = passwordHash;

      // Store in atom config
      atom.config.set('ftp-remote-edit.password', passwordHash);
      atom.config.set('ftp-remote-edit.reset', false);

      return true;
    }

    return false;
  }

  getServers(password) {
    const self = this;

    //debug
    self.info.server = self.testserver;

    if (self.info.server) return self.info.server;

    let secure = new Secure();
    let configHash = atom.config.get('ftp-remote-edit.config');

    if (configHash) {
      let config = secure.decrypt(password, configHash);
      self.info.server = JSON.parse(config);
      self.info.server.sort(function (a, b) {
        if (a.host < b.host) return -1;
        if (a.host > b.host) return 1;
        return 0;
      });

      return self.info.server;
    }

    return null;
  }

  setServers(server, password) {
    const self = this;
    let secure = new Secure();
    let config = JSON.stringify(server);
    let configHash = secure.encrypt(password, config);

    self.info.server = server;
    atom.config.set('ftp-remote-edit.config', configHash);
  }

  toggle() {
    const self = this;

    if (!self.info.password) {
      self.promtPassword(true);
      return;
    }

    self.treeView.toggle();
  }

  editServers() {
    this.ftpRemoteEditView = new FtpRemoteEditView();
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.ftpRemoteEditView,
    });
    this.ftpRemoteEditView.setPanel(this.modalPanel);
    this.ftpRemoteEditView.miniEditor.element.focus();

    this.modalPanel.getItem()
      .setState('editview');
    return true;
  }

  newFile(state) {

    let dir = document.querySelector('.list > .directory > .selected');
    let serverPath = dir.node.getPathOnServer();
    let ftp = null
    if (dir.node.getConnection()
      .sftp === true) {
      ftp = new Sftp(dir.node.getConnection());
    } else {
      ftp = new Ftp(dir.node.getConnection());
    }

    let dirChild = document.querySelector('.list > .directory > .selected')
      .parentNode.querySelectorAll('.list')[1];
    if (dirChild === undefined) {

      dir.node.openDirectory()
        .then(() => {
          dirChild = document.querySelector('.list > .directory > .selected')
            .parentNode.querySelectorAll('.list')[1];
          setInputField(dirChild);
        });

    } else {
      setInputField(dirChild);
    }

    function setInputField(dirChild) {
      let input = new TextEditor({
        mini: true
      });
      let dirList = document.querySelector('.list > .directory > .selected')
        .parentNode.querySelector('.list');

      dirList.insertBefore(input.element, dirList.childNodes[0]);
      input.element.focus();

      atom.commands.add(input.element, 'core:confirm', () => {

        if (/[<>:"\/\\|?*\x00-\x1F]/.test(input.getText()) === false && input.getText() !== '') {

          let newfile = serverPath + '/' + input.getText()
            .trim();
          let fileName = input.getText()
            .trim();
          newfile = newfile.trim();
          fileExists = document.querySelector('[pathonserver="' + newfile.trim() + '"]');

          if (fileExists === null) {

            ftp.saveFileToServer('', newfile.trim())
              .then(() => {

                let li = new FileView({
                  name: fileName,
                  pathOnServer: newfile
                });
                let pathList = [];

                dirChild.childNodes.forEach((item) => {
                  pathList.push(item.getAttribute('pathonserver'));
                });
                pathList.push(newfile);

                pathList = pathList.sort(function (a, b) {
                  if (a < b) return -1;
                  if (a > b) return 1;
                  return 0;
                });

                let indexOfNewPath = pathList.indexOf(newfile);

                li.setConnection(dir.node.getConnection());
                dirChild.insertBefore(li.element, dirChild.childNodes[indexOfNewPath]);
                li.getElement()
                  .querySelector('.message')
                  .click();
              });

            destroy();
          }
        }

      });

      input.element.addEventListener('blur', destroy);

      function destroy() {
        input.element.removeEventListener('blur', destroy);
        input.element.remove();
        input.destroy();
      }

    }

  }

  newDirectory(state) {

    let dir = document.querySelector('.list > .directory > .selected');
    let serverPath = dir.node.getPathOnServer();
    let ftp = null
    if (dir.node.getConnection()
      .sftp === true) {
      ftp = new Sftp(dir.node.getConnection());
    } else {
      ftp = new Ftp(dir.node.getConnection());
    }

    let dirChild = document.querySelector('.list > .directory > .selected')
      .parentNode.querySelector('.list');
    if (dirChild === null) {

      dir.node.openDirectory()
        .then(() => {
          dirChild = document.querySelector('.list > .directory > .selected')
            .parentNode.querySelector('.list');
          setInputField(dirChild);
        });

    } else {
      setInputField(dirChild);
    }

    function setInputField(dirChild) {
      let input = new TextEditor({
        mini: true
      });
      dirChild.insertBefore(input.element, dirChild.childNodes[0]);
      input.element.focus();

      atom.commands.add(input.element, 'core:confirm', () => {

        if (/[<>:"\/\\|?*\x00-\x1F]/.test(input.getText()) === false && input.getText() !== '') {

          let newDir = serverPath + '/' + input.getText();
          let dirName = input.getText();
          dirExists = document.querySelector('[pathonserver="' + newDir + '"]');

          if (dirExists === null) {

            ftp.createDirectory(newDir)
              .then(() => {

                let li = new DirectoryView({
                  name: dirName,
                  pathOnServer: newDir
                });
                let pathList = [];
                dirChild.childNodes.forEach((item) => {
                  pathList.push(item.getAttribute('pathonserver'));
                });
                pathList.push(newDir);

                pathList = pathList.sort(function (a, b) {
                  if (a < b) return -1;
                  if (a > b) return 1;
                  return 0;
                });

                let indexOfNewPath = pathList.indexOf(newDir);

                li.setConnection(dir.node.getConnection());
                dirChild.insertBefore(li.element, dirChild.childNodes[indexOfNewPath]);

              });

            destroy();
          }
        }

      });

      input.element.addEventListener('blur', destroy);

      function destroy() {
        input.element.removeEventListener('blur', destroy);
        input.element.remove();
        input.destroy();
      }

    }
  }

  deleteFile() {

    let dir = document.querySelector('.list > .file > .selected');
    let serverPath = dir.node.getPathOnServer();
    let ftp = null
    if (dir.node.getConnection()
      .sftp === true) {
      ftp = new Sftp(dir.node.getConnection());
    } else {
      ftp = new Ftp(dir.node.getConnection());
    }

    atom.confirm({
      message: 'Do you want to delete this file?',
      buttons: {
        Yes: () => {
          ftp.delete(serverPath)
            .then(() => {
              dir.parentNode.remove();
              dir.node.destroy();
            });
        },
        Cancel: () => {
          return true;
        }
      }
    });

  }

  deleteDirectory() {

    atom.confirm({
      message: 'Do you want to delete this Directory and all of its content?',
      buttons: {
        'Yes': () => {
          let dir = document.querySelector('.list > .directory > .selected');
          let serverPath = dir.node.getPathOnServer();
          let ftp = null
          if (dir.node.getConnection()
            .sftp === true) {
            ftp = new Sftp(dir.node.getConnection());
          } else {
            ftp = new Ftp(dir.node.getConnection());
          }

          dir.node.loader = dir.node.createLoader();
          dir.node.getElement()
            .appendChild(dir.node.loader);

          ftp.deleteDirectory(serverPath)
            .then(() => {
              dir.parentNode.remove();
              dir.node.destroy();
              dir.node.loader.remove();
            });
        },
        'Cancel': () => {
          return true;
        }
      }
    });

  }

  /**
   *
   * @param {String} element
   */
  rename(element) {

    console.log(element);

    let input = new TextEditor({
      mini: true
    });
    let dir = '';
    let messageElement = '';
    if (element === 'file') {
      dir = document.querySelector('.list > .file > .selected');
      messageElement = dir;
    } else if (element === 'directory') {
      dir = document.querySelector('.list > .directory > .selected');
      messageElement = dir.querySelector('.message');;
    }

    let serverPath = dir.node.getPathOnServer();
    let ftp = null
    if (dir.node.getConnection()
      .sftp === true) {
      ftp = new Sftp(dir.node.getConnection());
    } else {
      ftp = new Ftp(dir.node.getConnection());
    }

    input.element.addEventListener('blur', destroy);

    atom.commands.add(input.element, 'core:confirm', () => {

      let newDir = input.getText();
      let oldPathArr = serverPath.split('/');
      oldPathArr.pop();
      oldPathArr.push(newDir);
      newDir = oldPathArr.join('/')
        .trim();

      ftp.rename(serverPath, newDir)
        .then(() => {
          dir.parentNode.setAttribute('pathonserver', newDir);
          messageElement.textContent = input.getText();
          destroy();
        });

    });

    function destroy() {
      input.element.removeEventListener('blur', destroy);
      dir.removeAttribute('hidden');
      input.element.remove();
      input.destroy();
    }

    dir.setAttribute('hidden', true);
    dir.parentNode.appendChild(input.element);
    input.setText(messageElement.textContent);
    input.element.focus();

  }

}

export default new FtpRemoteEdit();
