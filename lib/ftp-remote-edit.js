'use babel';

import Secure from './Secure.js';

import ConfigurationView from './views/configuration-view';
import TreeView from './views/tree-view';

import PromptPassDialog from './dialogs/prompt-pass-dialog.js';
import AddDialog from './dialogs/add-dialog.js';
import RenameDialog from './dialogs/rename-dialog.js';

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
    self.configurationView = null;
  }

  activate() {
    const self = this;

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    self.listeners = new CompositeDisposable();

    // Register command that toggles this view
    self.listeners.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:toggle': () => self.toggle(),
      'ftp-remote-edit:edit-servers': () => self.editServers(),
      'ftp-remote-edit:new-file': () => self.newFile(),
      'ftp-remote-edit:new-directory': () => self.newDirectory(),
      'ftp-remote-edit:delete': () => self.delete(),
      'ftp-remote-edit:rename': () => self.rename(),
    }));

    self.treeView = new TreeView();
    self.treeView.detach();

    self.configurationView = new ConfigurationView();
    self.configurationView.detach();

    // Events
    atom.config.onDidChange('ftp-remote-edit.config', () => {
      self.treeView.servers = self.getServers(self.info.password);
      self.treeView.reload(true);
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

  promtPassword() {
    const self = this;
    const dialog = new PromptPassDialog('', true);

    let promise = new Promise((resolve, reject) => {
      dialog.on('dialog-done', (e, password) => {
        if (self.checkPassword(password)) {
          self.setPassword(password);
          dialog.close();

          resolve(true);
        } else {
          dialog.showError('Wrong password, try again!');
        }
      });

      dialog.attach();
    });

    return promise;
  }

  checkPassword(password) {
    let passwordHash = atom.config.get('ftp-remote-edit.password');
    if (!passwordHash) return true;

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

      return true;
    }

    return false;
  }

  getServers(password) {
    const self = this;

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

  editServers() {
    const self = this;

    if (!self.info.password) {
      self.promtPassword(true).then(() => {
        self.configurationView.password = self.info.password;
        self.configurationView.reload(true);
        self.configurationView.attach();
      });
      return;
    }else if(!self.configurationView.password){
      self.configurationView.password = self.info.password;
    }

    self.configurationView.reload(true);
    self.configurationView.attach();
  }

  toggle() {
    const self = this;

    if (!self.info.password) {
      self.promtPassword(true).then(() => {
        self.treeView.servers = self.getServers(self.info.password);
        self.treeView.reload();
        self.treeView.toggle();
      });
      return;
    }else if(!self.treeView.servers){
      self.treeView.servers = self.getServers(self.info.password);
      self.treeView.reload();
    }

    self.treeView.toggle();
  }

  newFile() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected) {
      if (!selected.view()
        .is('.directory')) {
        directory = selected.closest('.directory')
          .view();
      } else {
        directory = selected.view();
      }

      if (directory) {
        const dialog = new AddDialog(directory.getPath() + '/', true);
        dialog.on('new-path', (e, relativePath) => {
          if (relativePath) {
            directory.newFile(relativePath);
            dialog.close();
          }
        });
        dialog.attach();
      }
    }
  }

  newDirectory() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected) {
      if (!selected.view()
        .is('.directory')) {
        directory = selected.closest('.directory')
          .view();
      } else {
        directory = selected.view();
      }

      if (directory) {
        const dialog = new AddDialog(directory.getPath() + '/', false);
        dialog.on('new-path', (e, relativePath) => {
          if (relativePath) {
            directory.newDirectory(relativePath);
            dialog.close();
          }
        });
        dialog.attach();
      }
    }
  }

  rename() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected) {
      if (!selected.view()
        .is('.directory')) {
        let file = selected.view();
        if (file) {
          const dialog = new RenameDialog(file.getPath() + '/' + file.name, true);
          dialog.on('new-path', (e, relativePath) => {
            if (relativePath) {
              file.rename(relativePath);
              dialog.close();
            }
          });
          dialog.attach();
        }
      } else {
        let directory = selected.view();
        if (directory) {
          const dialog = new RenameDialog(directory.getPath(), false);
          dialog.on('new-path', (e, relativePath) => {
            if (relativePath) {
              directory.rename(relativePath);
              dialog.close();
            }
          });
          dialog.attach();
        }
      }
    }
  };

  delete() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected) {
      if (!selected.view()
        .is('.directory')) {
        let file = selected.view();
        if (file) {
          atom.confirm({
            message: 'Are you sure you want to delete this file?',
            detailedMessage: "You are deleting:\n" + file.getPath() + '/' + file.name,
            buttons: {
              Yes: () => {
                file.delete();
              },
              Cancel: () => {
                return true;
              }
            }
          });
        }
      } else {
        let directory = selected.view();
        if (directory) {
          atom.confirm({
            message: 'Are you sure you want to delete this folder?',
            detailedMessage: "You are deleting:\n" + directory.getPath(),
            buttons: {
              Yes: () => {
                directory.delete(true);
              },
              Cancel: () => {
                return true;
              }
            }
          });
        }
      }
    }
  };
}

export default new FtpRemoteEdit();
