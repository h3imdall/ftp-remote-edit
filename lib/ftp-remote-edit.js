'use babel';

import ConfigurationView from './views/configuration-view';
import TreeView from './views/tree-view';

import PromptPassDialog from './dialogs/prompt-pass-dialog.js';
import AddDialog from './dialogs/add-dialog.js';
import RenameDialog from './dialogs/rename-dialog.js';

import { decrypt, encrypt, checkPassword, setPassword } from './helper/secure.js';
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
      self.treeView.loadServers(self.info.password);
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
        if (checkPassword(password)) {
          setPassword(password)
            .then(() => {
              // Store in Session
              self.info.password = password;
            });
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

  toggle() {
    const self = this;

    if (!self.info.password) {
      self.promtPassword(true)
        .then(() => {
          self.treeView.loadServers(self.info.password);
          self.treeView.reload();
          self.treeView.toggle();
        });
      return;
    } else if (!self.treeView.servers) {
      self.treeView.loadServers(self.info.password);
      self.treeView.reload();
    }

    self.treeView.toggle();
  }

  editServers() {
    const self = this;

    if (!self.info.password) {
      self.promtPassword(true)
        .then(() => {
          self.configurationView.password = self.info.password;
          self.configurationView.reload(true);
          self.configurationView.attach();
        });
      return;
    } else if (!self.configurationView.password) {
      self.configurationView.password = self.info.password;
    }

    self.configurationView.reload(true);
    self.configurationView.attach();
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
