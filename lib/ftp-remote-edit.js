'use babel';

import { CompositeDisposable, Disposable } from 'atom';
import { decrypt, encrypt, checkPasswordExists, checkPassword, changePassword, isInWhiteList, isInBlackList, addToWhiteList, addToBlackList } from './helper/secure.js';
import { basename, dirname, trailingslashit, normalize } from './helper/format.js';
import { logDebug, showMessage, getFullExtension, createLocalPath, deleteLocalPath, moveLocalPath, getTextEditor, permissionsToRights, compareVersions } from './helper/helper.js';

let ConfigurationView = null;
let PermissionsView = null;
let TreeView = null;
let ProtocolView = null;
let FinderView = null;

let ChangePassDialog = null;
let PromptPassDialog = null;
let AddDialog = null;
let RenameDialog = null;
let FindDialog = null;
let DuplicateDialog = null;

let Electron = null;
let Path = null;
let FileSystem = null;
let Queue = null;
let Storage = null;

const atom = global.atom;
const getIconServices = require('./helper/icon.js');
const config = require('./config/config-schema.json');
const server_config = require('./config/server-schema.json');

class FtpRemoteEdit {

  constructor() {
    const self = this;

    self.state = {};
    self.config = config;
    self.subscriptions = null;

    self.treeView = null;
    self.protocolView = null;
    self.configurationView = null;
    self.finderView = null;
    self.loaded = false;

    self.currentDownloadPath = atom.config.get('ftp-remote-edit.transfer.defaultDownloadPath') || 'downloads';
    self.currentUploadPath = atom.config.get('ftp-remote-edit.transfer.defaultUploadPath') || 'desktop';
  }

  activate(state) {
    const self = this;

    // Get last project state
    self.state = state;

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    self.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    self.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:toggle': () => self.toggle(),
      'ftp-remote-edit:toggle-focus': () => self.toggleFocus(),
      'ftp-remote-edit:show': () => self.show(),
      'ftp-remote-edit:hide': () => self.hide(),
      'ftp-remote-edit:unfocus': () => self.unfocus(),
      'ftp-remote-edit:edit-servers': () => self.configuration(),
      'ftp-remote-edit:change-password': () => self.changePassword(),
      'ftp-remote-edit:open-file': () => self.open(),
      'ftp-remote-edit:open-file-pending': () => self.open(true),
      'ftp-remote-edit:new-file': () => self.create('file'),
      'ftp-remote-edit:new-directory': () => self.create('directory'),
      'ftp-remote-edit:duplicate': () => self.duplicate(),
      'ftp-remote-edit:delete': () => self.delete(),
      'ftp-remote-edit:rename': () => self.rename(),
      'ftp-remote-edit:copy': () => self.copy(),
      'ftp-remote-edit:cut': () => self.cut(),
      'ftp-remote-edit:paste': () => self.paste(),
      'ftp-remote-edit:chmod': () => self.chmod(),
      'ftp-remote-edit:upload-file': () => self.upload('file'),
      'ftp-remote-edit:upload-directory': () => self.upload('directory'),
      'ftp-remote-edit:download': () => self.download(),
      'ftp-remote-edit:reload': () => self.reload(),
      'ftp-remote-edit:reconnect': () => self.reconnect(),
      'ftp-remote-edit:find-remote-path': () => self.findRemotePath(),
      'ftp-remote-edit:copy-remote-path': () => self.copyRemotePath(),
      'ftp-remote-edit:finder': () => self.remotePathFinder(),
      'ftp-remote-edit:finder-reindex-cache': () => self.remotePathFinder(true),
      'ftp-remote-edit:add-temp-server': () => self.addTempServer(),
      'ftp-remote-edit:remove-temp-server': () => self.removeTempServer(),
    }));

    // Events
    atom.packages.onDidActivatePackage((activatePackage) => {
      if (activatePackage.name == 'ftp-remote-edit') {
        // Remove obsolete entries from the configuration
        let packageVersion = atom.packages.getActivePackage('ftp-remote-edit').metadata.version;
        if (compareVersions(packageVersion, '0.17.1') >= 0) {
          atom.config.unset('ftp-remote-edit.tree.showInDock');
          atom.config.unset('ftp-remote-edit.tree.showHiddenFiles');
          atom.config.unset('ftp-remote-edit.tree.showOnRightSide');
        }

        // Init package when lazy loading is disabled
        if (atom.config.get('ftp-remote-edit.dev.disableLazyLoading')) {
          self.init();
        }

        // Open the view automatically when atom starts
        if (atom.config.get('ftp-remote-edit.tree.toggleOnStartup')) {
          self.toggle();
        }
      }
    });
  }

  init() {
    const self = this;

    if (!self.loaded) {
      self.loaded = true;

      require('events').EventEmitter.defaultMaxListeners = 0;

      ConfigurationView = require('./views/configuration-view');
      PermissionsView = require('./views/permissions-view');
      TreeView = require('./views/tree-view');
      ProtocolView = require('./views/protocol-view');
      FinderView = require('./views/finder-view');

      ChangePassDialog = require('./dialogs/change-pass-dialog');
      PromptPassDialog = require('./dialogs/prompt-pass-dialog');
      AddDialog = require('./dialogs/add-dialog');
      RenameDialog = require('./dialogs/rename-dialog');
      FindDialog = require('./dialogs/find-dialog');
      DuplicateDialog = require('./dialogs/duplicate-dialog');

      Electron = require('electron');
      Path = require('path');
      FileSystem = require('fs-plus');
      Queue = require('./helper/queue.js');
      Storage = require('./helper/storage.js');

      // Load state
      Storage.loadState();

      // Events
      // Config change
      atom.config.onDidChange('ftp-remote-edit.config', () => {
        if (Storage.getPassword()) {
          Storage.load(true);
          self.getTreeViewInstance().reload();
        }
      });

      // Drag & Drop
      self.getTreeViewInstance().on('drop', (e) => {
        self.drop(e);
      });

      // Auto Reveal Active File
      atom.workspace.getCenter().onDidStopChangingActivePaneItem((item) => {
        self.autoRevealActiveFile();
      });

      // Workaround to activate core.allowPendingPaneItems if ftp-remote-edit.tree.allowPendingPaneItems is activated
      atom.config.onDidChange('ftp-remote-edit.tree.allowPendingPaneItems', ({ newValue, oldValue }) => {
        if (newValue == true && !atom.config.get('core.allowPendingPaneItems')) {
          atom.config.set('core.allowPendingPaneItems', true)
        }
      });
      if (atom.config.get('ftp-remote-edit.tree.allowPendingPaneItems')) {
        atom.config.set('core.allowPendingPaneItems', true)
      }

      // Init protocoll view
      self.getProtocolViewInstance();
    }
  }

  deactivate() {
    const self = this;

    if (self.subscriptions) {
      self.subscriptions.dispose();
      self.subscriptions = null;
    }

    // Save state
    if (atom.config.get('ftp-remote-edit.tree.restoreState') && self.loaded && Storage.loaded) {
      if (self.treeView) {
        Storage.state.treeView = self.treeView.serialize();
      }
      if (self.protocolView) {
        Storage.state.protocolView = self.protocolView.serialize();
      }
      Storage.saveState();
    }

    if (self.treeView) {
      self.treeView.destroy();
    }

    if (self.protocolView) {
      self.protocolView.destroy();
    }

    if (self.configurationView) {
      self.configurationView.destroy();
    }

    if (self.finderView) {
      finderView.destroy();
    }
  }

  serialize() {
    const self = this;

    return self.state;
  }

  handleURI(parsedUri) {
    const self = this;

    let regex = /(\/)?([a-z0-9_\-]{1,5}:\/\/)(([^:]{1,})((:(.{1,}))?[\@\x40]))?([a-z0-9_\-.]+)(:([0-9]*))?(.*)/gi;
    let is_matched = parsedUri.path.match(regex);

    if (is_matched) {

      if (!self.getTreeViewInstance().isVisible()) {
        self.toggle();
      }

      let matched = regex.exec(parsedUri.path);

      let protocol = matched[2];
      let username = (matched[4] !== undefined) ? decodeURIComponent(matched[4]) : '';
      let password = (matched[7] !== undefined) ? decodeURIComponent(matched[7]) : '';
      let host = (matched[8] !== undefined) ? matched[8] : '';
      let port = (matched[10] !== undefined) ? matched[10] : '';
      let path = (matched[11] !== undefined) ? decodeURIComponent(matched[11]) : "/";

      let newconfig = JSON.parse(JSON.stringify(server_config));
      newconfig.name = (username) ? protocol + username + '@' + host : protocol + host;
      newconfig.host = host;
      newconfig.port = (port) ? port : ((protocol == 'sftp://') ? '22' : '21');
      newconfig.user = username;
      newconfig.password = password;
      newconfig.sftp = (protocol == 'sftp://');
      newconfig.remote = path;
      newconfig.temp = true;

      logDebug("Adding new server by uri handler", newconfig);

      self.getTreeViewInstance().addServer(newconfig);
    }
  }

  openRemoteFile() {
    const self = this;

    return (file) => {
      const selected = self.getTreeViewInstance().list.find('.selected');

      if (selected.length === 0) return;

      let root = selected.view().getRoot();
      let localPath = normalize(root.getLocalPath());
      localPath = normalize(Path.join(localPath.slice(0, localPath.lastIndexOf(root.getPath())), file).replace(/\/+/g, Path.sep), Path.sep);

      try {
        let file = self.getTreeViewInstance().getElementByLocalPath(localPath, root, 'file');
        self.openFile(file);

        return true;
      } catch (ex) {
        logDebug(ex)

        return false;
      }
    }
  }

  getCurrentServerName() {
    const self = this;

    return () => {
      return new Promise((resolve, reject) => {
        const selected = self.getTreeViewInstance().list.find('.selected');
        if (selected.length === 0) reject('noservers');

        let root = selected.view().getRoot();
        resolve(root.name);
      })
    }
  }

  getCurrentServerConfig() {
    const self = this;

    return (reasonForRequest) => {
      return new Promise((resolve, reject) => {
        if (!reasonForRequest) {
          reject('noreasongiven');
          return;
        }

        const selected = self.getTreeViewInstance().list.find('.selected');
        if (selected.length === 0) {
          reject('noservers');
          return;
        }

        if (!Storage.hasPassword()) {
          reject('nopassword');
          return;
        }

        let root = selected.view().getRoot();
        let buttondismiss = false;

        if (isInBlackList(Storage.getPassword(), reasonForRequest)) {
          reject('userdeclined');
          return;
        }
        if (isInWhiteList(Storage.getPassword(), reasonForRequest)) {
          resolve(root.config);
          return;
        }

        let caution = 'Decline this message if you did not initiate a request to share your server configuration with a pacakge!'
        let notif = atom.notifications.addWarning('Server Configuration Requested', {
          detail: reasonForRequest + '\n-------------------------------\n' + caution,
          dismissable: true,
          buttons: [{
            text: 'Always',
            onDidClick: () => {
              buttondismiss = true;
              notif.dismiss();
              addToWhiteList(Storage.getPassword(), reasonForRequest);
              resolve(root.config);
            }
          },
          {
            text: 'Accept',
            onDidClick: () => {
              buttondismiss = true;
              notif.dismiss();
              resolve(root.config);
            }
          },
          {
            text: 'Decline',
            onDidClick: () => {
              buttondismiss = true;
              notif.dismiss();
              reject('userdeclined');
            }
          },
          {
            text: 'Never',
            onDidClick: () => {
              buttondismiss = true;
              notif.dismiss();
              addToBlackList(Storage.getPassword(), reasonForRequest);
              reject('userdeclined');
            }
          },
          ]
        });

        let disposable = notif.onDidDismiss(() => {
          if (!buttondismiss) reject('userdeclined');
          disposable.dispose();
        })
      })
    }
  }

  consumeElementIcons(service) {
    getIconServices().setElementIcons(service);

    return new Disposable(() => {
      getIconServices().resetElementIcons();
    })
  }

  promptPassword() {
    const self = this;
    const dialog = new PromptPassDialog('Enter password only for this session:');

    let promise = new Promise((resolve, reject) => {
      dialog.on('dialog-done', (e, password) => {
        if (checkPassword(password)) {
          Storage.setPassword(password);
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

    self.init();

    const options = {};
    if (mode == 'add') {
      options.mode = 'add';
      options.prompt = 'Enter the master password. All information about your server settings will be encrypted with this password.';
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
              showMessage('Master password does not match with previous used. Please retry or delete "config" entry in ftp-remote-edit configuration node.', 'error');

              dialog.close();
              resolve(false);
              return;
            }
          }
        }

        let oldPasswordValue = (mode == 'add') ? passwords.newPassword : passwords.oldPassword;

        changePassword(oldPasswordValue, passwords.newPassword).then(() => {
          Storage.setPassword(passwords.newPassword);

          if (mode != 'add') {
            showMessage('Master password successfully changed. Please restart atom!', 'success');
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

    self.init();

    if (!Storage.hasPassword()) {
      if (!checkPasswordExists()) {
        self.changePassword('add').then((returnValue) => {
          if (returnValue) {
            if (Storage.load()) {
              self.getTreeViewInstance().reload();
              self.getTreeViewInstance().toggle();
            }
          }
        });
        return;
      } else {
        self.promptPassword().then(() => {
          if (Storage.load()) {
            self.getTreeViewInstance().reload();
            self.getTreeViewInstance().toggle();
          }
        });
        return;
      }
    } else if (!Storage.loaded && Storage.load()) {
      self.getTreeViewInstance().reload();
    }
    self.getTreeViewInstance().toggle();
  }

  toggleFocus() {
    const self = this;

    self.init();

    if (!Storage.hasPassword()) {
      self.toggle();
    } else {
      self.getTreeViewInstance().toggleFocus();
    }
  }

  unfocus() {
    const self = this;

    self.getTreeViewInstance().unfocus();
  }

  show() {
    const self = this;

    self.init();

    if (!Storage.hasPassword()) {
      self.toggle();
    } else {
      self.getTreeViewInstance().show();
    }
  }

  hide() {
    const self = this;

    self.getTreeViewInstance().hide();
  }

  configuration() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    let root = null;
    if (selected.length !== 0) {
      root = selected.view().getRoot();
    };

    if (!Storage.hasPassword()) {
      self.promptPassword().then(() => {
        if (Storage.load()) {
          self.getConfigurationViewInstance().reload(root);
          self.getConfigurationViewInstance().attach();
        }
      });
      return;
    }

    self.getConfigurationViewInstance().reload(root);
    self.getConfigurationViewInstance().attach();
  }

  addTempServer() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    let root = null;
    if (selected.length !== 0) {
      root = selected.view().getRoot();
      root.config.temp = false;
      self.getTreeViewInstance().removeServer(selected.view());
      Storage.addServer(root.config);
      Storage.save();
    };
  }

  removeTempServer() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length !== 0) {
      self.getTreeViewInstance().removeServer(selected.view());
    };
  }

  reconnect() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    if (selected.view().is('.server')) {
      let server = selected.view();
      if (server) {
        server.getConnector().reconnect();
      }
    }
  }

  open(pending = false) {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    if (selected.view().is('.file')) {
      let file = selected.view();
      if (file) {
        self.openFile(file, pending);
      }
    } else if (selected.view().is('.directory')) {
      let directory = selected.view();
      if (directory) {
        self.openDirectory(directory);
      }
    }
  }

  openFile(file, pending = false) {
    const self = this;

    const fullRelativePath = normalize(file.getPath(true) + file.name);
    const fullLocalPath = normalize(file.getLocalPath(true) + file.name, Path.sep);

    // Check if file is already opened in texteditor
    if (getTextEditor(fullLocalPath, true)) {
      atom.workspace.open(fullLocalPath, { pending: pending, searchAllPanes: true })
      return false;
    }

    self.downloadFile(file.getRoot(), fullRelativePath, fullLocalPath, { filesize: file.size }).then(() => {
      // Open file and add handler to editor to upload file on save
      return self.openFileInEditor(file, pending);
    }).catch((err) => {
      showMessage(err, 'error');
    });
  }

  openDirectory(directory) {
    const self = this;

    directory.expand();
  }

  create(type) {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;
    if (selected.view().is('.file')) {
      var directory = selected.view().parent;
    } else {
      var directory = selected.view();
    }

    if (directory) {
      if (type == 'file') {
        const dialog = new AddDialog(directory.getPath(false), true);
        dialog.on('new-path', (e, relativePath) => {
          if (relativePath) {
            self.createFile(directory, relativePath);
            dialog.close();
          }
        });
        dialog.attach();
      } else if (type == 'directory') {
        const dialog = new AddDialog(directory.getPath(false), false);
        dialog.on('new-path', (e, relativePath) => {
          if (relativePath) {
            self.createDirectory(directory, relativePath);
            dialog.close();
          }
        });
        dialog.attach();
      }
    }
  }

  createFile(directory, relativePath) {
    const self = this;

    const fullRelativePath = normalize(directory.getRoot().getPath(true) + relativePath);
    const fullLocalPath = normalize(directory.getRoot().getLocalPath(true) + relativePath, Path.sep);

    try {
      // create local file
      if (!FileSystem.existsSync(fullLocalPath)) {
        // Create local Directory
        createLocalPath(fullLocalPath);
        FileSystem.writeFileSync(fullLocalPath, '');
      }
    } catch (err) {
      showMessage(err, 'error');
      return false;
    }

    directory.getConnector().existsFile(fullRelativePath).then(() => {
      showMessage('File ' + relativePath.trim() + ' already exists', 'error');
    }).catch(() => {
      self.uploadFile(directory, fullLocalPath, fullRelativePath, false).then((duplicatedFile) => {
        if (duplicatedFile) {
          // Open file and add handler to editor to upload file on save
          return self.openFileInEditor(duplicatedFile);
        }
      }).catch((err) => {
        showMessage(err, 'error');
      });
    });
  }

  createDirectory(directory, relativePath) {
    const self = this;

    relativePath = trailingslashit(relativePath);
    const fullRelativePath = normalize(directory.getRoot().getPath(true) + relativePath);
    const fullLocalPath = normalize(directory.getRoot().getLocalPath(true) + relativePath, Path.sep);

    // create local directory
    try {
      if (!FileSystem.existsSync(fullLocalPath)) {
        createLocalPath(fullLocalPath);
      }
    } catch (err) { }

    directory.getConnector().existsDirectory(fullRelativePath).then((result) => {
      showMessage('Directory ' + relativePath.trim() + ' already exists', 'error');
    }).catch((err) => {
      return directory.getConnector().createDirectory(fullRelativePath).then((result) => {
        // Add to tree
        let element = self.getTreeViewInstance().addDirectory(directory.getRoot(), relativePath);
        if (element.isVisible()) {
          element.select();
        }
      }).catch((err) => {
        showMessage(err.message, 'error');
      });
    });
  }

  rename() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    if (selected.view().is('.file')) {
      let file = selected.view();
      if (file) {
        const dialog = new RenameDialog(file.getPath(false) + file.name, true);
        dialog.on('new-path', (e, relativePath) => {
          if (relativePath) {
            self.renameFile(file, relativePath);
            dialog.close();
          }
        });
        dialog.attach();
      }
    } else if (selected.view().is('.directory')) {
      let directory = selected.view();
      if (directory) {
        const dialog = new RenameDialog(trailingslashit(directory.getPath(false)), false);
        dialog.on('new-path', (e, relativePath) => {
          if (relativePath) {
            self.renameDirectory(directory, relativePath);
            dialog.close();
          }
        });
        dialog.attach();
      }
    }
  }

  renameFile(file, relativePath) {
    const self = this;

    const fullRelativePath = normalize(file.getRoot().getPath(true) + relativePath);
    const fullLocalPath = normalize(file.getRoot().getLocalPath(true) + relativePath, Path.sep);

    file.getConnector().rename(file.getPath(true) + file.name, fullRelativePath).then(() => {
      // Refresh cache
      file.getRoot().getFinderCache().renameFile(normalize(file.getPath(false) + file.name), normalize(relativePath), file.size);

      // Add to tree
      let element = self.getTreeViewInstance().addFile(file.getRoot(), relativePath, { size: file.size, rights: file.rights });
      if (element.isVisible()) {
        element.select();
      }

      // Check if file is already opened in texteditor
      let found = getTextEditor(file.getLocalPath(true) + file.name);
      if (found) {
        element.addClass('open');
        found.saveObject = element;
        found.saveAs(element.getLocalPath(true) + element.name);
      }

      // Move local file
      moveLocalPath(file.getLocalPath(true) + file.name, fullLocalPath);

      // Remove old file from tree
      if (file) file.remove()
    }).catch((err) => {
      showMessage(err.message, 'error');
    });
  }

  renameDirectory(directory, relativePath) {
    const self = this;

    relativePath = trailingslashit(relativePath);
    const fullRelativePath = normalize(directory.getRoot().getPath(true) + relativePath);
    const fullLocalPath = normalize(directory.getRoot().getLocalPath(true) + relativePath, Path.sep);

    directory.getConnector().rename(directory.getPath(), fullRelativePath).then(() => {
      // Refresh cache
      directory.getRoot().getFinderCache().renameDirectory(normalize(directory.getPath(false)), normalize(relativePath + '/'));

      // Add to tree
      let element = self.getTreeViewInstance().addDirectory(directory.getRoot(), relativePath, { rights: directory.rights });
      if (element.isVisible()) {
        element.select();
      }

      // TODO
      // Check if files are already opened in texteditor

      // Move local directory
      moveLocalPath(directory.getLocalPath(true), fullLocalPath);

      // Remove old directory from tree
      if (directory) directory.remove()
    }).catch((err) => {
      showMessage(err.message, 'error');
    });
  }

  duplicate() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    if (selected.view().is('.file')) {
      let file = selected.view();
      if (file) {
        const dialog = new DuplicateDialog(file.getPath(false) + file.name);
        dialog.on('new-path', (e, relativePath) => {
          if (relativePath) {
            self.duplicateFile(file, relativePath);
            dialog.close();
          }
        });
        dialog.attach();
      }
    } else if (selected.view().is('.directory')) {
      // TODO
      // let directory = selected.view();
      // if (directory) {
      //   const dialog = new DuplicateDialog(trailingslashit(directory.getPath(false)));
      //   dialog.on('new-path', (e, relativePath) => {
      //     if (relativePath) {
      //       self.duplicateDirectory(directory, relativePath);
      //       dialog.close();
      //     }
      //   });
      //   dialog.attach();
      // }
    }
  }

  duplicateFile(file, relativePath) {
    const self = this;

    const fullRelativePath = normalize(file.getRoot().getPath(true) + relativePath);
    const fullLocalPath = normalize(file.getRoot().getLocalPath(true) + relativePath, Path.sep);

    file.getConnector().existsFile(fullRelativePath).then(() => {
      showMessage('File ' + relativePath.trim() + ' already exists', 'error');
    }).catch(() => {
      self.downloadFile(file.getRoot(), file.getPath(true) + file.name, fullLocalPath, { filesize: file.size }).then(() => {
        self.uploadFile(file.getRoot(), fullLocalPath, fullRelativePath).then((duplicatedFile) => {
          if (duplicatedFile) {
            // Open file and add handler to editor to upload file on save
            return self.openFileInEditor(duplicatedFile);
          }
        }).catch((err) => {
          showMessage(err, 'error');
        });
      }).catch((err) => {
        showMessage(err, 'error');
      });
    });
  }

  duplicateDirectory(directory, relativePath) {
    const self = this;

    const fullRelativePath = normalize(directory.getRoot().getPath(true) + relativePath);
    const fullLocalPath = normalize(directory.getRoot().getLocalPath(true) + relativePath, Path.sep);

    // TODO
  }

  delete() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    if (selected.view().is('.file')) {
      let file = selected.view();
      if (file) {
        atom.confirm({
          message: 'Are you sure you want to delete this file?',
          detailedMessage: "You are deleting:\n" + file.getPath(false) + file.name,
          buttons: ['Yes', 'Cancel'],
        }, (response) => {
          if (response == 0) {
            self.deleteFile(file);
          }
        });
      }
    } else if (selected.view().is('.directory')) {
      let directory = selected.view();
      if (directory) {
        atom.confirm({
          message: 'Are you sure you want to delete this folder?',
          detailedMessage: "You are deleting:\n" + trailingslashit(directory.getPath(false)),
          buttons: ['Yes', 'Cancel'],
        }, (response) => {
          if (response == 0) {
            self.deleteDirectory(directory, true);
          }
        });
      }
    }
  }

  deleteFile(file) {
    const self = this;

    const fullLocalPath = normalize(file.getLocalPath(true) + file.name, Path.sep);

    file.getConnector().deleteFile(file.getPath(true) + file.name).then(() => {
      // Refresh cache
      file.getRoot().getFinderCache().deleteFile(normalize(file.getPath(false) + file.name));

      // Delete local file
      try {
        if (FileSystem.existsSync(fullLocalPath)) {
          FileSystem.unlinkSync(fullLocalPath);
        }
      } catch (err) { }

      file.parent.select();
      file.destroy();
    }).catch((err) => {
      showMessage(err.message, 'error');
    });
  }

  deleteDirectory(directory, recursive) {
    const self = this;

    directory.getConnector().deleteDirectory(directory.getPath(), recursive).then(() => {
      // Refresh cache
      directory.getRoot().getFinderCache().deleteDirectory(normalize(directory.getPath(false)));

      const fullLocalPath = (directory.getLocalPath(true)).replace(/\/+/g, Path.sep);

      // Delete local directory
      deleteLocalPath(fullLocalPath);

      directory.parent.select();
      directory.destroy();
    }).catch((err) => {
      showMessage(err.message, 'error');
    });
  }

  chmod() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    if (selected.view().is('.file')) {
      let file = selected.view();
      if (file) {
        const permissionsView = new PermissionsView(file);
        permissionsView.on('change-permissions', (e, result) => {
          self.chmodFile(file, result.permissions);
        });
        permissionsView.attach();
      }
    } else if (selected.view().is('.directory')) {
      let directory = selected.view();
      if (directory) {
        const permissionsView = new PermissionsView(directory);
        permissionsView.on('change-permissions', (e, result) => {
          self.chmodDirectory(directory, result.permissions);
        });
        permissionsView.attach();
      }
    }
  }

  chmodFile(file, permissions) {
    const self = this;

    file.getConnector().chmodFile(file.getPath(true) + file.name, permissions).then((responseText) => {
      file.rights = permissionsToRights(permissions);
    }).catch((err) => {
      showMessage(err.message, 'error');
    });
  }

  chmodDirectory(directory, permissions) {
    const self = this;

    directory.getConnector().chmodDirectory(directory.getPath(true), permissions).then((responseText) => {
      directory.rights = permissionsToRights(permissions);
    }).catch((err) => {
      showMessage(err.message, 'error');
    });
  }

  reload() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    if (selected.view().is('.file')) {
      let file = selected.view();
      if (file) {
        self.reloadFile(file);
      }
    } else if (selected.view().is('.directory') || selected.view().is('.server')) {
      let directory = selected.view();
      if (directory) {
        self.reloadDirectory(directory);
      }
    }
  }

  reloadFile(file) {
    const self = this;

    const fullRelativePath = normalize(file.getPath(true) + file.name);
    const fullLocalPath = normalize(file.getLocalPath(true) + file.name, Path.sep);

    // Check if file is already opened in texteditor
    if (getTextEditor(fullLocalPath, true)) {
      self.downloadFile(file.getRoot(), fullRelativePath, fullLocalPath, { filesize: file.size }).catch((err) => {
        showMessage(err, 'error');
      });
    }
  }

  reloadDirectory(directory) {
    const self = this;

    directory.expanded = false;
    directory.expand();
  }

  copy() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;
    if (!Storage.hasPassword()) return;

    let element = selected.view();
    if (element.is('.file')) {
      let storage = element.serialize();
      window.sessionStorage.removeItem('ftp-remote-edit:cutPath')
      window.sessionStorage['ftp-remote-edit:copyPath'] = encrypt(Storage.getPassword(), JSON.stringify(storage));
    } else if (element.is('.directory')) {
      // TODO
    }
  }

  cut() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;
    if (!Storage.hasPassword()) return;

    let element = selected.view();

    if (element.is('.file') || element.is('.directory')) {
      let storage = element.serialize();
      window.sessionStorage.removeItem('ftp-remote-edit:copyPath')
      window.sessionStorage['ftp-remote-edit:cutPath'] = encrypt(Storage.getPassword(), JSON.stringify(storage));
    }
  }

  paste() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;
    if (!Storage.hasPassword()) return;

    let destObject = selected.view();
    if (destObject.is('.file')) {
      destObject = destObject.parent;
    }

    let dataObject = null;
    let srcObject = null;
    let handleEvent = null;

    let srcType = null;
    let srcPath = null;
    let destPath = null;

    // Parse data from copy/cut/drag event
    if (window.sessionStorage['ftp-remote-edit:cutPath']) {
      // Cut event from Atom
      handleEvent = "cut";

      let cutObjectString = decrypt(Storage.getPassword(), window.sessionStorage['ftp-remote-edit:cutPath']);
      dataObject = (cutObjectString) ? JSON.parse(cutObjectString) : null;

      let find = self.getTreeViewInstance().list.find('#' + dataObject.id);
      if (!find) return;

      srcObject = find.view();
      if (!srcObject) return;

      if (srcObject.is('.directory')) {
        srcType = 'directory';
        srcPath = srcObject.getPath(true);
        destPath = destObject.getPath(true) + srcObject.name;
      } else {
        srcType = 'file';
        srcPath = srcObject.getPath(true) + srcObject.name;
        destPath = destObject.getPath(true) + srcObject.name;
      }

      // Check if copy/cut operation should be performed on the same server
      if (JSON.stringify(destObject.config) != JSON.stringify(srcObject.config)) return;

      window.sessionStorage.removeItem('ftp-remote-edit:cutPath');
      window.sessionStorage.removeItem('ftp-remote-edit:copyPath');
    } else if (window.sessionStorage['ftp-remote-edit:copyPath']) {
      // Copy event from Atom
      handleEvent = "copy";

      let copiedObjectString = decrypt(Storage.getPassword(), window.sessionStorage['ftp-remote-edit:copyPath']);
      dataObject = (copiedObjectString) ? JSON.parse(copiedObjectString) : null;

      let find = self.getTreeViewInstance().list.find('#' + dataObject.id);
      if (!find) return;

      srcObject = find.view();
      if (!srcObject) return;

      if (srcObject.is('.directory')) {
        srcType = 'directory';
        srcPath = srcObject.getPath(true);
        destPath = destObject.getPath(true) + srcObject.name;
      } else {
        srcType = 'file';
        srcPath = srcObject.getPath(true) + srcObject.name;
        destPath = destObject.getPath(true) + srcObject.name;
      }

      // Check if copy/cut operation should be performed on the same server
      if (JSON.stringify(destObject.config) != JSON.stringify(srcObject.config)) return;

      window.sessionStorage.removeItem('ftp-remote-edit:cutPath');
      window.sessionStorage.removeItem('ftp-remote-edit:copyPath');
    } else {
      return;
    }

    if (handleEvent == "cut") {
      if (srcType == 'directory') self.moveDirectory(destObject.getRoot(), srcPath, destPath);
      if (srcType == 'file') self.moveFile(destObject.getRoot(), srcPath, destPath);
    } else if (handleEvent == "copy") {
      if (srcType == 'directory') self.copyDirectory(destObject.getRoot(), srcPath, destPath);
      if (srcType == 'file') self.copyFile(destObject.getRoot(), srcPath, destPath, { filesize: srcObject.size });
    }
  }

  drop(e) {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;
    if (!Storage.hasPassword()) return;

    let destObject = selected.view();
    if (destObject.is('.file')) {
      destObject = destObject.parent;
    }

    let entry, initialPath, initialName, initialType, ref;
    if (entry = e.target.closest('.entry')) {
      e.preventDefault();
      e.stopPropagation();

      if (!destObject.is('.directory') && !destObject.is('.server')) {
        return;
      }

      if (e.dataTransfer) {
        initialPath = e.dataTransfer.getData("initialPath");
        initialName = e.dataTransfer.getData("initialName");
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialPath = e.originalEvent.dataTransfer.getData("initialPath");
        initialName = e.originalEvent.dataTransfer.getData("initialName");
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }

      if (initialType == "directory") {
        if (normalize(initialPath) == normalize(destObject.getPath(false) + initialName + '/')) return;
      } else if (initialType == "file") {
        if (normalize(initialPath) == normalize(destObject.getPath(false) + initialName)) return;
      }

      if (initialPath) {
        // Drop event from Atom
        if (initialType == "directory") {
          let srcPath = trailingslashit(destObject.getRoot().getPath(true)) + initialPath;
          let destPath = destObject.getPath(true) + initialName + '/';

          if (atom.config.get('ftp-remote-edit.tree.dragAndDropConfirmation')) {
            atom.confirm({
              message: 'Are you sure you want to move this directory?',
              detailedMessage: "You are moving:\n" + trailingslashit(normalize(srcPath)),
              buttons: ['Yes', 'Cancel'],
            }, (response) => {
              if (response == 0) {
                self.moveDirectory(destObject.getRoot(), srcPath, destPath);
              }
            });
          } else {
            self.moveDirectory(destObject.getRoot(), srcPath, destPath);
          }
        } else if (initialType == "file") {
          let srcPath = trailingslashit(destObject.getRoot().getPath(true)) + initialPath;
          let destPath = destObject.getPath(true) + initialName;

          if (atom.config.get('ftp-remote-edit.tree.dragAndDropConfirmation')) {
            atom.confirm({
              message: 'Are you sure you want to move this file?',
              detailedMessage: "You are moving:\n" + trailingslashit(normalize(srcPath)),
              buttons: ['Yes', 'Cancel'],
            }, (response) => {
              if (response == 0) {
                self.moveFile(destObject.getRoot(), srcPath, destPath);
              }
            });
          } else {
            self.moveFile(destObject.getRoot(), srcPath, destPath);
          }
        }
      } else {
        // Drop event from OS
        if (e.dataTransfer) {
          ref = e.dataTransfer.files;
        } else {
          ref = e.originalEvent.dataTransfer.files;
        }

        for (let i = 0, len = ref.length; i < len; i++) {
          let file = ref[i];
          let srcPath = file.path;
          let destPath = destObject.getPath(true) + basename(file.path, Path.sep);

          if (FileSystem.statSync(file.path).isDirectory()) {
            self.uploadDirectory(destObject.getRoot(), srcPath, destPath).catch((err) => {
              showMessage(err, 'error');
            });
          } else {
            self.uploadFile(destObject.getRoot(), srcPath, destPath).catch((err) => {
              showMessage(err, 'error');
            });
          }
        }
      }

    }
  }

  upload(type) {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;
    if (!Storage.hasPassword()) return;

    let destObject = selected.view();
    if (destObject.is('.file')) {
      destObject = destObject.parent;
    }

    let defaultPath = self.currentUploadPath;
    if (['project', 'desktop', 'downloads'].includes(defaultPath) === false && FileSystem.existsSync(defaultPath) === false) {
      defaultPath = atom.config.get('ftp-remote-edit.transfer.defaultUploadPath') || 'desktop';
    }

    if (defaultPath == 'project') {
      const projects = atom.project.getPaths();
      defaultPath = projects.shift();
    } else if (defaultPath == 'desktop') {
      defaultPath = Electron.remote.app.getPath("desktop")
    } else if (defaultPath == 'downloads') {
      defaultPath = Electron.remote.app.getPath("downloads")
    }
    let srcPath = null;
    let destPath = null;

    if (type == 'file') {
      Electron.remote.dialog.showOpenDialog(null, { title: 'Select file(s) for upload...', defaultPath: defaultPath, buttonLabel: 'Upload', properties: ['openFile', 'multiSelections', 'showHiddenFiles'] }).then((result) => {
        const filePaths = result.filePaths;
        if (result.canceled === false) {
          self.currentUploadPath = Path.dirname(filePaths[0]);
          Promise.all(filePaths.map((filePath) => {
            srcPath = filePath;
            destPath = destObject.getPath(true) + basename(filePath, Path.sep);
            return self.uploadFile(destObject.getRoot(), srcPath, destPath);
          })).then(() => {
            showMessage('File(s) has been uploaded to: \r \n' + filePaths.join('\r \n'), 'success');
          }).catch((err) => {
            showMessage(err, 'error');
          });
        }
      });
    } else if (type == 'directory') {
      Electron.remote.dialog.showOpenDialog(null, { title: 'Select directory for upload...', defaultPath: defaultPath, buttonLabel: 'Upload', properties: ['openDirectory', 'showHiddenFiles'] }).then((result) => {
        const directoryPaths = result.filePaths;
        if (result.canceled === false) {
          self.currentUploadPath = Path.dirname(directoryPaths[0]);
          directoryPaths.forEach((directoryPath, index) => {
            srcPath = directoryPath;
            destPath = destObject.getPath(true) + basename(directoryPath, Path.sep);

            self.uploadDirectory(destObject.getRoot(), srcPath, destPath).then((result) => {
              if (result != false) {
                showMessage('Directory has been uploaded to ' + destPath, 'success');
              }
            }).catch((err) => {
              showMessage(err, 'error');
            });
          });
        }
      });
    }
  }

  download() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;
    if (!Storage.hasPassword()) return;

    let defaultPath = self.currentDownloadPath;
    if (['project', 'desktop', 'downloads'].includes(defaultPath) === false && FileSystem.existsSync(defaultPath) === false) {
      defaultPath = atom.config.get('ftp-remote-edit.transfer.defaultDownloadPath') || 'downloads';
    }

    if (defaultPath == 'project') {
      const projects = atom.project.getPaths();
      defaultPath = projects.shift();
    } else if (defaultPath == 'desktop') {
      defaultPath = Electron.remote.app.getPath("desktop")
    } else if (defaultPath == 'downloads') {
      defaultPath = Electron.remote.app.getPath("downloads")
    }

    if (selected.view().is('.file')) {
      let file = selected.view();
      if (file) {
        const srcPath = normalize(file.getPath(true) + file.name);

        Electron.remote.dialog.showSaveDialog(null, { defaultPath: defaultPath + "/" + file.name }).then((result) => {
          const destPath = result.filePath;
          if (result.canceled === false) {
            self.currentDownloadPath = Path.dirname(destPath);
            self.downloadFile(file.getRoot(), srcPath, destPath, { filesize: file.size }).then(() => {
              showMessage('File has been downloaded to ' + destPath, 'success');
            }).catch((err) => {
              showMessage(err, 'error');
            });
          }
        });
      }
    } else if (selected.view().is('.directory')) {
      let directory = selected.view();
      if (directory) {
        const srcPath = normalize(directory.getPath(true));

        Electron.remote.dialog.showSaveDialog(null, { defaultPath: defaultPath + "/" + directory.name }).then((result) => {
          const destPath = result.filePath;
          if (result.canceled === false) {
            self.currentDownloadPath = Path.dirname(destPath);
            self.downloadDirectory(directory.getRoot(), srcPath, destPath).then(() => {
              showMessage('Directory has been downloaded to ' + destPath, 'success');
            }).catch((err) => {
              showMessage(err, 'error');
            });
          }
        });
      }
    } else if (selected.view().is('.server')) {
      let server = selected.view();
      if (server) {
        const srcPath = normalize(server.getPath(true));

        Electron.remote.dialog.showSaveDialog(null, { defaultPath: defaultPath + "/" }).then((result) => {
          const destPath = result.filePath;
          if (result.canceled === false) {
            self.currentDownloadPath = Path.dirname(destPath);
            self.downloadDirectory(server, srcPath, destPath).then(() => {
              showMessage('Directory has been downloaded to ' + destPath, 'success');
            }).catch((err) => {
              showMessage(err, 'error');
            });
          }
        });
      }
    }
  }

  moveFile(server, srcPath, destPath) {
    const self = this;

    if (normalize(srcPath) == normalize(destPath)) return;

    server.getConnector().existsFile(destPath).then((result) => {
      return new Promise((resolve, reject) => {
        atom.confirm({
          message: 'File already exists. Are you sure you want to overwrite this file?',
          detailedMessage: "You are overwrite:\n" + destPath.trim(),
          buttons: ['Yes', 'Cancel'],
        }, (response) => {
          if (response == 0) {
            server.getConnector().deleteFile(destPath).then(() => {
              reject(true);
            }).catch((err) => {
              showMessage(err.message, 'error');
              resolve(false);
            });
          } else {
            resolve(false);
          }
        });
      });
    }).catch(() => {
      server.getConnector().rename(srcPath, destPath).then(() => {
        // get info from old object
        let oldObject = self.getTreeViewInstance().findElementByPath(server, trailingslashit(srcPath.replace(server.config.remote, '')));
        const cachePath = normalize(destPath.replace(server.getRoot().config.remote, '/'));

        // Add to tree
        let element = self.getTreeViewInstance().addFile(server, cachePath, { size: (oldObject) ? oldObject.size : null, rights: (oldObject) ? oldObject.rights : null });
        if (element.isVisible()) {
          element.select();
        }

        // Refresh cache
        server.getFinderCache().renameFile(normalize(srcPath.replace(server.config.remote, '/')), normalize(destPath.replace(server.config.remote, '/')), (oldObject) ? oldObject.size : 0);

        if (oldObject) {
          // Check if file is already opened in texteditor
          let found = getTextEditor(oldObject.getLocalPath(true) + oldObject.name);
          if (found) {
            element.addClass('open');
            found.saveObject = element;
            found.saveAs(element.getLocalPath(true) + element.name);
          }

          // Move local file
          moveLocalPath(oldObject.getLocalPath(true) + oldObject.name, element.getLocalPath(true) + element.name);

          // Remove old object
          oldObject.remove();
        }
      }).catch((err) => {
        showMessage(err.message, 'error');
      });
    });
  }

  moveDirectory(server, srcPath, destPath) {
    const self = this;

    let initialPath = trailingslashit(srcPath);
    destPath = trailingslashit(destPath);

    if (normalize(srcPath) == normalize(destPath)) return;

    server.getConnector().existsDirectory(destPath).then((result) => {
      return new Promise((resolve, reject) => {
        atom.confirm({
          message: 'Directory already exists. Are you sure you want to overwrite this directory?',
          detailedMessage: "You are overwrite:\n" + destPath.trim(),
          buttons: ['Yes', 'Cancel'],
        }, (response) => {
          if (response == 0) {
            server.getConnector().deleteDirectory(destPath).then(() => {
              reject(true);
            }).catch((err) => {
              showMessage(err.message, 'error');
              resolve(false);
            });
          } else {
            resolve(false);
          }
        });
      });
    }).catch(() => {
      server.getConnector().rename(srcPath, destPath).then(() => {
        // get info from old object
        let oldObject = self.getTreeViewInstance().findElementByPath(server, trailingslashit(srcPath.replace(server.config.remote, '')));
        const cachePath = normalize(destPath.replace(server.getRoot().config.remote, '/'));

        // Add to tree
        let element = self.getTreeViewInstance().addDirectory(server.getRoot(), cachePath, { size: (oldObject) ? oldObject.size : null, rights: (oldObject) ? oldObject.rights : null });
        if (element.isVisible()) {
          element.select();
        }

        // Refresh cache
        server.getFinderCache().renameDirectory(normalize(srcPath.replace(server.config.remote, '/')), normalize(destPath.replace(server.config.remote, '/')));

        if (oldObject) {
          // TODO
          // Check if file is already opened in texteditor

          // Move local file
          moveLocalPath(oldObject.getLocalPath(true), element.getLocalPath(true));

          // Remove old object
          if (oldObject) oldObject.remove();
        }
      }).catch((err) => {
        showMessage(err.message, 'error');
      });
    });
  }

  copyFile(server, srcPath, destPath, param = {}) {
    const self = this;

    const srcLocalPath = normalize(server.getLocalPath(false) + srcPath, Path.sep);
    const destLocalPath = normalize(server.getLocalPath(false) + destPath, Path.sep);

    // Rename file if exists
    if (srcPath == destPath) {
      let originalPath = normalize(destPath);
      let parentPath = normalize(dirname(destPath));

      server.getConnector().listDirectory(parentPath).then((list) => {
        let files = [];
        let fileList = list.filter((item) => {
          return item.type === '-';
        });

        fileList.forEach((element) => {
          files.push(element.name);
        });

        let filePath;
        let fileCounter = 0;
        const extension = getFullExtension(originalPath);

        // append a number to the file if an item with the same name exists
        while (files.includes(basename(destPath))) {
          filePath = Path.dirname(originalPath) + '/' + Path.basename(originalPath, extension);
          destPath = filePath + fileCounter + extension;
          fileCounter += 1;
        }

        self.copyFile(server, srcPath, destPath);
      }).catch((err) => {
        showMessage(err.message, 'error');
      });

      return;
    }

    // Create local Directories
    createLocalPath(srcLocalPath);
    createLocalPath(destLocalPath);

    self.downloadFile(server, srcPath, destLocalPath, param).then(() => {
      self.uploadFile(server, destLocalPath, destPath).then((duplicatedFile) => {
        if (duplicatedFile) {
          // Open file and add handler to editor to upload file on save
          return self.openFileInEditor(duplicatedFile);
        }
      }).catch((err) => {
        showMessage(err, 'error');
      });
    }).catch((err) => {
      showMessage(err, 'error');
    });
  }

  copyDirectory(server, srcPath, destPath) {
    const self = this;

    if (normalize(srcPath) == normalize(destPath)) return;

    // TODO
    console.log('TODO copy', srcPath, destPath);
  }

  uploadFile(server, srcPath, destPath, checkFileExists = true) {
    const self = this;

    if (checkFileExists) {
      let promise = new Promise((resolve, reject) => {
        return server.getConnector().existsFile(destPath).then((result) => {
          const cachePath = normalize(destPath.replace(server.getRoot().config.remote, '/'));

          return new Promise((resolve, reject) => {
            atom.confirm({
              message: 'File already exists. Are you sure you want to overwrite this file?',
              detailedMessage: "You are overwrite:\n" + cachePath,
              buttons: ['Yes', 'Cancel'],
            }, (response) => {
              if (response == 0) {
                server.getConnector().deleteFile(destPath).then(() => {
                  reject(true);
                }).catch((err) => {
                  showMessage(err.message, 'error');
                  resolve(false);
                });
              } else {
                resolve(false);
              }
            });
          });
        }).catch((err) => {
          let filestat = FileSystem.statSync(srcPath);

          let pathOnFileSystem = normalize(trailingslashit(srcPath), Path.sep);
          let foundInTreeView = self.getTreeViewInstance().findElementByLocalPath(pathOnFileSystem);
          if (foundInTreeView) {
            // Add sync icon
            foundInTreeView.addSyncIcon();
          }

          // Add to Upload Queue
          let queueItem = Queue.addFile({
            direction: "upload",
            remotePath: destPath,
            localPath: srcPath,
            size: filestat.size
          });

          return server.getConnector().uploadFile(queueItem, 1).then(() => {
            const cachePath = normalize(destPath.replace(server.getRoot().config.remote, '/'));

            // Add to tree
            let element = self.getTreeViewInstance().addFile(server.getRoot(), cachePath, { size: filestat.size });
            if (element.isVisible()) {
              element.select();
            }

            // Refresh cache
            server.getRoot().getFinderCache().deleteFile(normalize(cachePath));
            server.getRoot().getFinderCache().addFile(normalize(cachePath), filestat.size);

            if (foundInTreeView) {
              // Remove sync icon
              foundInTreeView.removeSyncIcon();
            }

            resolve(element);
          }).catch((err) => {
            queueItem.changeStatus('Error');

            if (foundInTreeView) {
              // Remove sync icon
              foundInTreeView.removeSyncIcon();
            }

            reject(err);
          });
        });
      });

      return promise;
    } else {
      let promise = new Promise((resolve, reject) => {
        let filestat = FileSystem.statSync(srcPath);

        let pathOnFileSystem = normalize(trailingslashit(srcPath), Path.sep);
        let foundInTreeView = self.getTreeViewInstance().findElementByLocalPath(pathOnFileSystem);
        if (foundInTreeView) {
          // Add sync icon
          foundInTreeView.addSyncIcon();
        }

        // Add to Upload Queue
        let queueItem = Queue.addFile({
          direction: "upload",
          remotePath: destPath,
          localPath: srcPath,
          size: filestat.size
        });

        return server.getConnector().uploadFile(queueItem, 1).then(() => {
          const cachePath = normalize(destPath.replace(server.getRoot().config.remote, '/'));

          // Add to tree
          let element = self.getTreeViewInstance().addFile(server.getRoot(), cachePath, { size: filestat.size });
          if (element.isVisible()) {
            element.select();
          }

          // Refresh cache
          server.getRoot().getFinderCache().deleteFile(normalize(cachePath));
          server.getRoot().getFinderCache().addFile(normalize(cachePath), filestat.size);

          if (foundInTreeView) {
            // Remove sync icon
            foundInTreeView.removeSyncIcon();
          }

          resolve(element);
        }).catch((err) => {
          queueItem.changeStatus('Error');

          if (foundInTreeView) {
            // Remove sync icon
            foundInTreeView.removeSyncIcon();
          }

          reject(err);
        });
      });

      return promise;
    }
  }

  uploadDirectory(server, srcPath, destPath) {
    const self = this;

    destPath = trailingslashit(destPath);

    return server.getConnector().existsDirectory(destPath).then((result) => {
      return new Promise((resolve, reject) => {
        atom.confirm({
          message: 'Directory already exists. Are you sure you want to overwrite this directory?',
          detailedMessage: "You are overwrite:\n" + destPath.trim(),
          buttons: ['Yes', 'Cancel'],
        }, (response) => {
          if (response == 0) {
            reject(true);
          } else {
            resolve(false);
          }
        });
      });
    }).catch(() => {
      return new Promise((resolve, reject) => {
        FileSystem.listTreeSync(srcPath).filter((path) => FileSystem.isFileSync(path)).reduce((prevPromise, path) => {
          return prevPromise.then(() => self.uploadFile(server, path, normalize(destPath + '/' + path.replace(srcPath, '/'), '/'), false));
        }, Promise.resolve()).then(() => resolve()).catch((error) => reject(error));
      });
    });
  }

  downloadFile(server, srcPath, destPath, param = {}) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      // Check if file is already in Queue
      if (Queue.existsFile(destPath)) {
        return reject(false);
      }

      let pathOnFileSystem = normalize(trailingslashit(server.getLocalPath(false) + srcPath), Path.sep);
      let foundInTreeView = self.getTreeViewInstance().findElementByLocalPath(pathOnFileSystem);
      if (foundInTreeView) {
        // Add sync icon
        foundInTreeView.addSyncIcon();
      }

      // Create local Directories
      createLocalPath(destPath);

      // Add to Download Queue
      let queueItem = Queue.addFile({
        direction: "download",
        remotePath: srcPath,
        localPath: destPath,
        size: (param.filesize) ? param.filesize : 0
      });

      // Download file
      server.getConnector().downloadFile(queueItem).then(() => {
        if (foundInTreeView) {
          // Remove sync icon
          foundInTreeView.removeSyncIcon();
        }

        resolve(true);
      }).catch((err) => {
        queueItem.changeStatus('Error');

        if (foundInTreeView) {
          // Remove sync icon
          foundInTreeView.removeSyncIcon();
        }

        reject(err);
      });
    });

    return promise;
  }

  downloadDirectory(server, srcPath, destPath) {
    const self = this;

    const scanDir = (path) => {
      return server.getConnector().listDirectory(path).then(list => {
        const files = list.filter((item) => (item.type === '-')).map((item) => {
          item.path = normalize(path + '/' + item.name);
          return item;
        });
        const dirs = list.filter((item) => (item.type === 'd' && item.name !== '.' && item.name !== '..')).map((item) => {
          item.path = normalize(path + '/' + item.name);
          return item;
        });

        return dirs.reduce((prevPromise, dir) => {
          return prevPromise.then(output => {
            return scanDir(normalize(dir.path)).then(files => {
              return output.concat(files);
            });
          });
        }, Promise.resolve(files));
      });
    };

    return scanDir(srcPath).then((files) => {
      try {
        if (!FileSystem.existsSync(destPath)) {
          FileSystem.mkdirSync(destPath);
        }
      } catch (error) {
        return Promise.reject(error);
      }

      return new Promise((resolve, reject) => {
        files.reduce((prevPromise, file) => {
          return prevPromise.then(() => self.downloadFile(server, file.path, normalize(destPath + Path.sep + file.path.replace(srcPath, '/'), Path.sep), { filesize: file.size }));
        }, Promise.resolve()).then(() => resolve()).catch((error) => reject(error));
      });
    }).catch((error) => {
      return Promise.reject(error);
    });
  }

  findRemotePath() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    const dialog = new FindDialog('/', false);
    dialog.on('find-path', (e, relativePath) => {
      if (relativePath) {
        relativePath = normalize(relativePath);

        let root = selected.view().getRoot();

        // Remove initial path if exists
        if (root.config.remote) {
          if (relativePath.startsWith(root.config.remote)) {
            relativePath = relativePath.replace(root.config.remote, "");
          }
        }

        self.getTreeViewInstance().expand(root, relativePath).catch((err) => {
          showMessage(err, 'error');
        });

        dialog.close();
      }
    });
    dialog.attach();
  }

  copyRemotePath() {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    let element = selected.view();
    let pathToCopy = element.getPath(true) + (element.is('.directory') ? "" : element.name);
    atom.clipboard.write(pathToCopy)
  }

  remotePathFinder(reindex = false) {
    const self = this;
    const selected = self.getTreeViewInstance().list.find('.selected');

    if (selected.length === 0) return;

    let root = selected.view().getRoot();
    let itemsCache = root.getFinderCache();

    if (self.finderView == null) {
      self.finderView = new FinderView(self.getTreeViewInstance());

      self.finderView.on('ftp-remote-edit-finder:open', (item) => {
        let relativePath = item.relativePath;
        let localPath = normalize(self.finderView.root.getLocalPath() + relativePath, Path.sep);
        let file = self.getTreeViewInstance().getElementByLocalPath(localPath, self.finderView.root, 'file');
        file.size = item.size;

        if (file) self.openFile(file);
      });

      self.finderView.on('ftp-remote-edit-finder:hide', () => {
        itemsCache.loadTask = false;
      });
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

    itemsCache.load(reindex);
    self.finderView.toggle();
  }

  autoRevealActiveFile() {
    const self = this;

    if (atom.config.get('ftp-remote-edit.tree.autoRevealActiveFile')) {
      if (self.getTreeViewInstance().isVisible()) {
        let editor = atom.workspace.getActiveTextEditor();

        if (editor && editor.getPath()) {
          let pathOnFileSystem = normalize(trailingslashit(editor.getPath()), Path.sep);

          let entry = self.getTreeViewInstance().findElementByLocalPath(pathOnFileSystem);
          if (entry && entry.isVisible()) {
            entry.select();
            self.getTreeViewInstance().remoteKeyboardNavigationMovePage();
          }
        }
      }
    }
  }

  openFileInEditor(file, pending) {
    const self = this;

    return atom.workspace.open(normalize(file.getLocalPath(true) + file.name, Path.sep), { pending: pending, searchAllPanes: true }).then((editor) => {
      file.open();

      try {
        // Save file on remote server
        editor.saveObject = file;
        editor.onDidSave((saveObject) => {
          if (!editor.saveObject) return;

          // Get filesize
          const filestat = FileSystem.statSync(editor.getPath(true));
          editor.saveObject.size = filestat.size;
          editor.saveObject.attr('data-size', filestat.size);

          const srcPath = editor.saveObject.getLocalPath(true) + editor.saveObject.name;
          const destPath = editor.saveObject.getPath(true) + editor.saveObject.name;
          self.uploadFile(editor.saveObject.getRoot(), srcPath, destPath, false).then((duplicatedFile) => {
            if (duplicatedFile) {
              if (atom.config.get('ftp-remote-edit.notifications.showNotificationOnUpload')) {
                showMessage('File successfully uploaded.', 'success');
              }
            }
          }).catch((err) => {
            showMessage(err, 'error');
          });
        });

        editor.onDidDestroy(() => {
          if (!editor.saveObject) return;
          editor.saveObject.close();
        });
      } catch (err) { }
    }).catch((err) => {
      showMessage(err.message, 'error');
    });
  }

  getTreeViewInstance() {
    const self = this;

    self.init();

    if (self.treeView == null) {
      self.treeView = new TreeView(Storage.state.treeView);
    }
    return self.treeView;
  }

  getProtocolViewInstance() {
    const self = this;

    self.init();

    if (self.protocolView == null) {
      self.protocolView = new ProtocolView(Storage.state.protocolView);
    }
    return self.protocolView;
  }

  getConfigurationViewInstance() {
    const self = this;

    self.init();

    if (self.configurationView == null) {
      self.configurationView = new ConfigurationView();
    }
    return self.configurationView;
  }
}

export default new FtpRemoteEdit();
