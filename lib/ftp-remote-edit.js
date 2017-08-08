'use babel';

import ConfigurationView from './views/configuration-view';
import TreeView from './views/tree-view';

import ChangePassDialog from './dialogs/change-pass-dialog.js';
import PromptPassDialog from './dialogs/prompt-pass-dialog.js';
import AddDialog from './dialogs/add-dialog.js';
import RenameDialog from './dialogs/rename-dialog.js';
import FindDialog from './dialogs/find-dialog.js';

import { decrypt, encrypt, checkPasswordExists, checkPassword, setPassword, changePassword } from './helper/secure.js';
import { basename, trailingslashit } from './helper/format.js';
import { CompositeDisposable, TextEditor } from 'atom';

const atom = global.atom;
const config = require('./config/config-schema.json');

class FtpRemoteEdit {

  constructor() {
    const self = this;

    self.info = [];
    self.config = config;
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
      'ftp-remote-edit:change-password': () => self.changePassword(),
      'ftp-remote-edit:new-file': () => self.newFile(),
      'ftp-remote-edit:new-directory': () => self.newDirectory(),
      'ftp-remote-edit:delete': () => self.delete(),
      'ftp-remote-edit:rename': () => self.rename(),
      'ftp-remote-edit:find': () => self.find(),
    }));

    self.treeView = new TreeView();
    self.treeView.detach();

    self.configurationView = new ConfigurationView();
    self.configurationView.detach();

    // Events
    atom.config.onDidChange('ftp-remote-edit.config', () => {
      if (self.info.password) {
        self.treeView.loadServers(self.info.password);
        self.treeView.reload(true);
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

  promtPassword() {
    const self = this;
    const dialog = new PromptPassDialog();

    let promise = new Promise((resolve, reject) => {
      dialog.on('dialog-done', (e, password) => {
        if (checkPassword(password)) {
          self.info.password = password;
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

  changePassword(mode) {
    const self = this;

    const options = {};
    if (mode == 'add') {
      options.mode = 'add';
      options.prompt = options.prompt || 'Enter the master password. All information about your server settings will be encrypted with this password.';
    } else {
      options.mode = 'change';
    }

    const dialog = new ChangePassDialog(options);
    let promise = new Promise((resolve, reject) => {
      dialog.on('dialog-done', (e, passwords) => {
        changePassword(passwords.oldPassword, passwords.newPassword)
          .then(() => {
            self.info.password = passwords.newPassword;

            if (mode != 'add') {
              atom.notifications.addSuccess('Ftp-Remote-Edit', {
                description: 'Master password successfully changed. Please restart atom!'
              });
            }
            resolve(true);
          });
        dialog.close();
      });

      dialog.attach();
    });

    return promise;
  }

  toggle() {
    const self = this;

    if (!self.info.password) {
      if (!checkPasswordExists()) {
        self.changePassword('add')
          .then(() => {
            self.treeView.loadServers(self.info.password);
            self.treeView.reload();
            self.treeView.toggle();
          });
        return;
      } else {
        self.promtPassword()
          .then(() => {
            self.treeView.loadServers(self.info.password);
            self.treeView.reload();
            self.treeView.toggle();
          });
        return;
      }
    } else if (!self.treeView.servers) {
      self.treeView.loadServers(self.info.password);
      self.treeView.reload();
    }

    self.treeView.toggle();
  }

  editServers() {
    const self = this;

    const selected = self.treeView.list.find('.selected');
    let root = null;

    if (selected.length > 0) {
      root = selected.view()
        .getRoot();
    }

    if (!self.info.password) {
      self.promtPassword(true)
        .then(() => {
          self.configurationView.password = self.info.password;
          self.configurationView.reload(true, root);
          self.configurationView.attach();
        });
      return;
    } else if (!self.configurationView.password) {
      self.configurationView.password = self.info.password;
    }

    self.configurationView.reload(true, root);
    self.configurationView.attach();
  }

  newFile() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected) {
      if (!selected.view()
        .is('.directory')) {
        directory = selected.closest('.entry')
          .view();
      } else {
        directory = selected.view();
      }

      if (directory) {
        const dialog = new AddDialog(directory.getPath(false), true);
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
        directory = selected.closest('.entry')
          .view();
      } else {
        directory = selected.view();
      }

      if (directory) {
        const dialog = new AddDialog(directory.getPath(false), false);
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
          const dialog = new RenameDialog(file.getPath(false) + file.name, true);
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
          const dialog = new RenameDialog(trailingslashit(directory.getPath(false)), false);
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
            detailedMessage: "You are deleting:\n" + file.getPath(false) + file.name,
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
            detailedMessage: "You are deleting:\n" + trailingslashit(directory.getPath(false)),
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

  find() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;
    const dialog = new FindDialog('/', false);
    dialog.on('find-path', (e, relativePath) => {
      if (relativePath) {
        let root = null;
        root = selected.view()
          .getRoot();
        root.expandPath(relativePath, true)
          .then(() => {})
          .catch(function (err) {
            root.connector.showMessage(err, 'error');
          });

        dialog.close();
      }
    });
    dialog.attach();
  };
}

export default new FtpRemoteEdit();
