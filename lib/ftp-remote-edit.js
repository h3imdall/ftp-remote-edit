'use babel';

import ConfigurationView from './views/configuration-view';
import PermissionsView from './views/permissions-view';
import TreeView from './views/tree-view';
import ProtocolView from './views/protocol-view';
import FinderView from './views/finder-view';

import ChangePassDialog from './dialogs/change-pass-dialog.js';
import PromptPassDialog from './dialogs/prompt-pass-dialog.js';
import AddDialog from './dialogs/add-dialog.js';
import RenameDialog from './dialogs/rename-dialog.js';
import FindDialog from './dialogs/find-dialog.js';

import { $ } from 'atom-space-pen-views';
import { decrypt, encrypt, checkPasswordExists, checkPassword, setPassword, changePassword } from './helper/secure.js';
import { basename, trailingslashit } from './helper/format.js';
import { CompositeDisposable, Disposable, TextEditor } from 'atom';

const getIconServices = require('./helper/icon.js');
const atom = global.atom;
const config = require('./config/config-schema.json');

require('events').EventEmitter.defaultMaxListeners = 0;

class FtpRemoteEdit {

  constructor() {
    const self = this;

    self.info = [];
    self.config = config;
    self.listeners = [];

    self.treeView = null;
    self.protocolView = null;
    self.configurationView = null;
    self.finderView = null;

    self.debug = false;
  }

  activate() {
    const self = this;

    self.debug = atom.config.get('ftp-remote-edit.dev.debug');

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
      'ftp-remote-edit:permissions': () => self.permissions(),
      'ftp-remote-edit:find': () => self.findRemotePath(),
      'ftp-remote-edit:copy-remote-path': () => self.copyRemotePath(),
      'ftp-remote-edit:finder': () => self.remotePathFinder(),
      'ftp-remote-edit:finder-reindex-cache': () => self.remotePathFinder(true),
    }));

    self.treeView = new TreeView();
    self.protocolView = new ProtocolView();

    // Events
    atom.config.onDidChange('ftp-remote-edit.config', () => {
      if (self.info.password) {
        self.treeView.loadServers(self.info.password);
        self.treeView.reload(true);
      }
    });

    // Auto Reveal Active File
    atom.workspace.onDidChangeActivePaneItem(() => {
      self.autoRevealActiveFile(self.treeView);
    });

    // workaround to activate core.allowPendingPaneItems if ftp-remote-edit.tree.allowPendingPaneItems is activated
    atom.config.onDidChange('ftp-remote-edit.tree.allowPendingPaneItems', ({ newValue, oldValue }) => {
      if (newValue == true && !atom.config.get('core.allowPendingPaneItems')) {
        atom.config.set('core.allowPendingPaneItems', true)
      }
    });
    if (atom.config.get('ftp-remote-edit.tree.allowPendingPaneItems')) {
      atom.config.set('core.allowPendingPaneItems', true)
    }

    // Toggle on startup
    atom.packages.onDidActivatePackage((package) => {
      if (package.name == 'ftp-remote-edit') {
        if (atom.config.get('ftp-remote-edit.tree.toggleOnStartup')) {
          self.toggle();
        }
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

  handleURI(parsedUri) {
    const self = this;

    let regex = /(\/)?([a-z0-9_\-]{1,5}:\/\/)(([a-z0-9_\-\s]{1,})((:([a-z0-9_\-\s]{1,}))?[\@\x40]))?([a-z0-9_\-.]+)(:([0-9]*))?/gi;
    let is_matched = parsedUri.path.match(regex);

    if (is_matched) {
      let matched = regex.exec(parsedUri.path);

      let protocol = matched[2];
      let username = matched[4];
      let password = matched[7];
      let host = matched[8];
      let port = matched[10];

      let new_server_config = {
        "name": protocol + username + '@' + host,
        "host": host,
        "port": port,
        "user": username,
        "password": password,
        "sftp": (protocol == 'sftp://'),
        "privatekeyfile": "",
        "remote": "/"
      };
      if (self.debug) {
        console.log("Adding new server by uri handler", new_server_config);
      }

      self.treeView.addServer(new_server_config);
    }
  }

  consumeElementIcons(service) {
    getIconServices().setElementIcons(service)
    return new Disposable(() => {
      getIconServices().resetElementIcons()
    })
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

        // Check that password from new master password can decrypt current config
        if (mode == 'add') {
          let configHash = atom.config.get('ftp-remote-edit.config');
          if (configHash) {
            let newPassword = passwords.newPassword;
            let testConfig = decrypt(newPassword, configHash);

            try {
              let testJson = JSON.parse(testConfig);
            } catch (e) {
              // If master password does not decrypt current config,
              // prompt the user to reply to insert correct password
              // or reset config content
              atom.notifications.addError('Ftp-Remote-Edit', {
                description: 'Master password does not match with previous used. Please retry or delete "config" entry in ftp-remote-edit configuration node.'
              });

              dialog.close();
              resolve(false);
              return;
            }
          }
        }

        let oldPasswordValue = (mode == 'add') ? passwords.newPassword : passwords.oldPassword;

        changePassword(oldPasswordValue, passwords.newPassword)
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
          .then((returnValue) => {
            if (returnValue) {
              if (self.treeView.loadServers(self.info.password)) {
                self.treeView.reload();
                self.treeView.toggle();
              }
            }
          });
        return;
      } else {
        self.promtPassword()
          .then(() => {
            if (self.treeView.loadServers(self.info.password)) {
              self.treeView.reload();
              self.treeView.toggle();
            }
          });
        return;
      }
    } else if (!self.treeView.servers) {
      if (self.treeView.loadServers(self.info.password)) {
        self.treeView.reload();
      }
    }
    self.treeView.toggle();
  }

  editServers() {
    const self = this;

    const selected = self.treeView.list.find('.selected');
    let root = null;

    if (self.configurationView == null) {
      self.configurationView = new ConfigurationView();
    }

    if (selected.length > 0) {
      root = selected.view().getRoot();
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
      if (!selected.view().is('.directory')) {
        let file = selected.view();
        if (file) {
          const dialog = new RenameDialog(file.getPath(false) + file.name, true);
          dialog.on('new-path', (e, relativePath) => {
            if (relativePath) {
              file.renameFile(relativePath);
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
              directory.renameDirectory(relativePath);
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
      if (!selected.view().is('.directory')) {
        let file = selected.view();
        if (file) {
          atom.confirm({
            message: 'Are you sure you want to delete this file?',
            detailedMessage: "You are deleting:\n" + file.getPath(false) + file.name,
            buttons: {
              Yes: () => {
                file.deleteFile();
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
                directory.deleteDirectory(true);
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
    if (!srcObject) return;

    // extratct paths
    let srcPathToCopy = null;
    let destPathToCopy = null;
    let srcType = null;

    if (srcObject.is('.directory')) {
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

  permissions() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    let element = selected.view();

    const permissionsView = new PermissionsView(element);
    permissionsView.on('change-permissions', (e, result) => {
      if (element.is('.directory')) {
        element.chmodDirectory(result.permissions);

      } else {
        element.chmodFile(result.permissions);
      }
    });
    permissionsView.attach();
  }

  findRemotePath() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;
    const dialog = new FindDialog('/', false);
    dialog.on('find-path', (e, relativePath) => {
      if (relativePath) {
        let root = null;
        root = selected.view().getRoot();

        // Remove initial path if exists
        if (root.config.remote) {
          relativePath = relativePath.replace(/\/+/g, "/").replace(root.config.remote, "");
        }

        root.expandPath(relativePath, true).catch(function (err) {
          root.connector.showMessage(err, 'error');
        });

        dialog.close();
      }
    });
    dialog.attach();
  };

  remotePathFinder(reindex = false) {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    let root = selected.view().getRoot();
    let itemsCache = root.getFinderItemsCache();

    if (self.finderView == null) {
      self.finderView = new FinderView(self.treeView);
    }

    self.finderView.root = root;
    self.finderView.selectListView.update({ items: itemsCache.items })

    const index = (items) => {
      self.finderView.selectListView.update({ items: items, errorMessage: '', loadingMessage: 'Indexing\u2026' + items.length })
    };
    itemsCache.removeListener('finder-items-cache-queue:index', index);
    itemsCache.on('finder-items-cache-queue:index', index);

    const update = (items) => {
      self.finderView.selectListView.update({ items: items, errorMessage: '', loadingMessage: '' })
    };
    itemsCache.removeListener('finder-items-cache-queue:update', update);
    itemsCache.on('finder-items-cache-queue:update', update);

    const finish = (items) => {
      self.finderView.selectListView.update({ items: items, errorMessage: '', loadingMessage: '' })
    };
    itemsCache.removeListener('finder-items-cache-queue:finish', finish);
    itemsCache.on('finder-items-cache-queue:finish', finish);

    const error = (err) => {
      self.finderView.selectListView.update({ errorMessage: 'Error: ' + err.message })
    };
    itemsCache.removeListener('finder-items-cache-queue:error', error);
    itemsCache.on('finder-items-cache-queue:error', error);

    const reset = () => {
      itemsCache.loadTask = false;
    };
    self.finderView.removeListener('ftp-remote-edit-finder:hide', reset);
    self.finderView.on('ftp-remote-edit-finder:hide', reset);

    itemsCache.load(reindex);
    self.finderView.toggle();
  }

  copyRemotePath() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    let element = selected.view();
    if (element.is('.directory')) {
      pathToCopy = element.getPath(true);
    } else {
      pathToCopy = element.getPath(true) + element.name;
    }
    atom.clipboard.write(pathToCopy)
  }

  autoRevealActiveFile(treeView) {
    const self = this;

    if (atom.config.get('ftp-remote-edit.tree.autoRevealActiveFile')) {
      if (treeView && treeView.isVisible()) {
        let activePane = atom.workspace.getActivePane();
        let workspaceView = atom.views.getView(atom.workspace);
        let editor = atom.workspace.getActiveTextEditor();

        if (editor && editor.getPath()) {
          let localPath = (trailingslashit(editor.getPath())).replace(/\/+/g, "/");
          treeView.getServerByLocalPath(localPath).then((server) => {
            let root = server.getRoot();
            let entry = treeView.getElementByLocalPath(localPath, root, 'file');
            if (entry) {
              let elementsToDeselect = $('#' + entry.id);
              if (elementsToDeselect) {
                for (i = 0, len = elementsToDeselect.length; i < len; i++) {
                  root.deselect();
                  elementsToDeselect[i].classList.add('selected');
                }
              }
            }
          });
        }
      }
    }
  }
}

export default new FtpRemoteEdit();
