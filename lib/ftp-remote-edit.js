'use babel';

import ConfigurationView from './views/configuration-view';
import TreeView from './views/tree-view';
import ProtocolView from './views/protocol-view';
import FinderView from './views/finder-view';

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
    self.protocolView = null;
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
      'ftp-remote-edit:copy': () => self.copy(),
      'ftp-remote-edit:cut': () => self.cut(),
      'ftp-remote-edit:paste': () => self.paste(),
      'ftp-remote-edit:find': () => self.findRemotePath(),
      'ftp-remote-edit:finder': () => self.remotePathFinder(),
      'ftp-remote-edit:copy-remote-path': () => self.copyRemotePath(),
    }));

    self.treeView = new TreeView();
    self.treeView.detach();

    self.protocolView = new ProtocolView();

    self.configurationView = new ConfigurationView();
    self.configurationView.detach();
    self.finderView = new FinderView();

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
      if (selected.view()
        .is('.file')) {
        directory = selected.view()
          .parent;
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
      if (selected.view()
        .is('.file')) {
        directory = selected.view()
          .parent;
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

  copy() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;
    if (!self.info.password) return;

    let element = selected.view();
    let storage = element.serialize();
    window.sessionStorage.removeItem('ftp-remote-edit:cutPath')
    window.sessionStorage['ftp-remote-edit:copyPath'] = encrypt(self.info.password, JSON.stringify(storage));
  }

  cut() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;
    if (!self.info.password) return;

    let element = selected.view();
    let storage = element.serialize();
    window.sessionStorage.removeItem('ftp-remote-edit:copyPath')
    window.sessionStorage['ftp-remote-edit:cutPath'] = encrypt(self.info.password, JSON.stringify(storage));
  }

  paste() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;
    if (!self.info.password) return;

    let dataObject = null;
    let srcObject = null;
    let destObject = selected.view();
    let handleEvent = null;

    // Parse data from copy/cut event
    if (window.sessionStorage['ftp-remote-edit:cutPath']) {
      let cutObjectString = decrypt(self.info.password, window.sessionStorage['ftp-remote-edit:cutPath']);
      dataObject = (cutObjectString) ? JSON.parse(cutObjectString) : null;
      handleEvent = "cut";
      window.sessionStorage.removeItem('ftp-remote-edit:cutPath')
      window.sessionStorage.removeItem('ftp-remote-edit:copyPath')
    } else if (window.sessionStorage['ftp-remote-edit:copyPath']) {
      let copiedObjectString = decrypt(self.info.password, window.sessionStorage['ftp-remote-edit:copyPath']);
      dataObject = (copiedObjectString) ? JSON.parse(copiedObjectString) : null;
      handleEvent = "copy";
      window.sessionStorage.removeItem('ftp-remote-edit:cutPath')
      window.sessionStorage.removeItem('ftp-remote-edit:copyPath')
    }

    if (!dataObject) return;

    // find copied / cutted entry
    let find = self.treeView.list.find('#' + dataObject.id);
    if (!find) return;
    srcObject = find.view();

    // extratct paths
    let srcPathToCopy = null;
    let destPathToCopy = null;
    let srcType = null;
    if (String(srcObject.constructor.name) === "_DirectoryView") {
      srcPathToCopy = srcObject.getPath(false);
      destPathToCopy = destObject.getPath(false) + srcObject.name;
      srcType = "DirectoryView";
    } else {
      srcPathToCopy = srcObject.getPath(false) + srcObject.name;
      destPathToCopy = destObject.getPath(false) + srcObject.name;
      srcType = "FileView";
    }

    // Check if copy/cut operation should be performed on the same server
    if (JSON.stringify(destObject.config) == JSON.stringify(srcObject.config)) {

      // operation should be performed on the same server
      if (handleEvent == "cut") {
        if (srcType == "DirectoryView") destObject.moveDirectory(srcPathToCopy, destPathToCopy);
        if (srcType == "FileView") destObject.moveFile(srcPathToCopy, destPathToCopy);
      } else if (handleEvent == "copy") {
        if (srcType == "DirectoryView") destObject.copyDirectory(srcPathToCopy, destPathToCopy);
        if (srcType == "FileView") destObject.copyFile(srcPathToCopy, destPathToCopy);
      }
    } else {

      // operation should be performed between two servers
      if (handleEvent == "cut") {
        // TODO
      } else if (handleEvent == "copy") {
        // TODO
      }

    }
  }

  findRemotePath() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;
    const dialog = new FindDialog('/', false);
    dialog.on('find-path', (e, relativePath) => {
      if (relativePath) {
        let root = null;
        root = selected.view()
          .getRoot();
        // Remove initial path if exists
        if (root.config.remote) {
          relativePath = relativePath.replace(/\/+/g, "/")
            .replace(root.config.remote, "");
        }

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

  remotePathFinder() {
    const self = this;
    const selected = self.treeView.list.find('.selected');
    if(!selected) {
      return
    }
    self.finderView.toggle(selected);
  }

  copyRemotePath() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    let element = selected.view();
    if (String(element.constructor.name) === "_DirectoryView") {
      pathToCopy = element.getPath(true);
    } else {
      pathToCopy = element.getPath(true) + element.name;
    }
    atom.clipboard.write(pathToCopy)
  }
}

export default new FtpRemoteEdit();
