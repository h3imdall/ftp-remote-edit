'use babel';

import ConfigurationView from './views/configuration-view';
import PermissionsView from './views/permissions-view';
import TreeView from './views/tree-view';
import ProtocolView from './views/protocol-view';
import FinderView from './views/finder-view';
import DirectoryView from './views/directory-view.js';
import FileView from './views/file-view.js';

import ChangePassDialog from './dialogs/change-pass-dialog.js';
import PromptPassDialog from './dialogs/prompt-pass-dialog.js';
import AddDialog from './dialogs/add-dialog.js';
import RenameDialog from './dialogs/rename-dialog.js';
import FindDialog from './dialogs/find-dialog.js';
import DuplicateDialog from './dialogs/duplicate-dialog';

import { CompositeDisposable, Disposable, TextEditor } from 'atom';
import { decrypt, encrypt, checkPasswordExists, checkPassword, setPassword, changePassword, isInWhiteList, isInBlackList, addToWhiteList, addToBlackList } from './helper/secure.js';
import { basename, dirname, trailingslashit, untrailingslashit, leadingslashit, unleadingslashit, normalize } from './helper/format.js';
import { showMessage, getFullExtension, createLocalPath, deleteLocalPath, moveLocalPath, getTextEditor, permissionsToRights } from './helper/helper.js';

const config = require('./config/config-schema.json');
const server_config = require('./config/server-schema.json');

const atom = global.atom;
const Path = require('path');
const FileSystem = require('fs-plus');
const getIconServices = require('./helper/icon.js');
const Queue = require('./helper/queue.js');
const Storage = require('./helper/storage.js');

require('events').EventEmitter.defaultMaxListeners = 0;

class FtpRemoteEdit {

  constructor() {
    const self = this;

    self.info = [];
    self.config = config;
    self.subscriptions = null;

    self.treeView = null;
    self.protocolView = null;
    self.configurationView = null;
    self.finderView = null;

    self.debug = false;
  }

  activate() {
    const self = this;

    self.debug = atom.config.get('ftp-remote-edit.dev.debug');

    self.treeView = new TreeView();
    self.protocolView = new ProtocolView();

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    self.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    self.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:toggle': () => self.toggle(),
      'ftp-remote-edit:toggle-focus': () => self.toggleFocus(),
      'ftp-remote-edit:show': () => self.show(),
      'ftp-remote-edit:hide': () => self.hide(),
      'ftp-remote-edit:unfocus': () => self.treeView.unfocus(),
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
      'ftp-remote-edit:find-remote-path': () => self.findRemotePath(),
      'ftp-remote-edit:copy-remote-path': () => self.copyRemotePath(),
      'ftp-remote-edit:finder': () => self.remotePathFinder(),
      'ftp-remote-edit:finder-reindex-cache': () => self.remotePathFinder(true),
      'ftp-remote-edit:add-temp-to-config': () => self.addTempToConfig(),
    }));

    // Events
    atom.config.onDidChange('ftp-remote-edit.config', () => {
      if (Storage.getPassword()) {
        Storage.load(true);
        self.treeView.reload();
      }
    });

    // Drag & Drop
    self.treeView.on('drop', (e) => {
      self.drop(e);
    });

    // Auto Reveal Active File
    atom.workspace.getCenter().onDidStopChangingActivePaneItem((item) => {
      self.autoRevealActiveFile();
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
    atom.packages.onDidActivatePackage((activatePackage) => {
      if (activatePackage.name == 'ftp-remote-edit') {
        if (atom.config.get('ftp-remote-edit.tree.toggleOnStartup')) {
          self.toggle();
        }
      }
    });
  }

  deactivate() {
    const self = this;

    if (self.subscriptions) {
      self.subscriptions.dispose();
      self.subscriptions = null;
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
    return {};
  }

  handleURI(parsedUri) {
    const self = this;

    let regex = /(\/)?([a-z0-9_\-]{1,5}:\/\/)(([^:]{1,})((:(.{1,}))?[\@\x40]))?([a-z0-9_\-.]+)(:([0-9]*))?(.*)/gi;
    let is_matched = parsedUri.path.match(regex);

    if (is_matched) {

      if (!self.treeView.isVisible()) {
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

      if (self.debug) {
        console.log("Adding new server by uri handler", newconfig);
      }

      self.treeView.addServer(newconfig);
    }
  }

  openRemoteFile() {
    const self = this;

    return (file) => {
      const selected = self.treeView.list.find('.selected');

      if (selected.length === 0) return;

      let root = selected.view().getRoot();
      let localPath = normalize(root.getLocalPath());
      localPath = normalize(Path.join(localPath.slice(0, localPath.lastIndexOf(root.getPath())), file).replace(/\/+/g, Path.sep), Path.sep);

      try {
        let file = self.treeView.getElementByLocalPath(localPath, root, 'file');
        self.openFile(file);

        return true;
      } catch (ex) {
        if (self.debug) {
          console.log(ex);
        }

        return false;
      }
    }
  }

  getCurrentServerName() {
    const self = this;

    return () => {
      return new Promise((resolve, reject) => {
        const selected = self.treeView.list.find('.selected');
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

        const selected = self.treeView.list.find('.selected');
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

  promtPassword() {
    const self = this;
    const dialog = new PromptPassDialog();

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

    if (!Storage.hasPassword()) {
      if (!checkPasswordExists()) {
        self.changePassword('add').then((returnValue) => {
          if (returnValue) {
            if (Storage.load()) {
              self.treeView.reload();
              self.treeView.toggle();
            }
          }
        });
        return;
      } else {
        self.promtPassword().then(() => {
          if (Storage.load()) {
            self.treeView.reload();
            self.treeView.toggle();
          }
        });
        return;
      }
    } else if (!Storage.loaded && Storage.load()) {
      self.treeView.reload();
    }
    self.treeView.toggle();
  }

  toggleFocus() {
    const self = this;

    if (!Storage.hasPassword()) {
      self.toggle();
    } else {
      self.treeView.toggleFocus();
    }
  }

  show() {
    const self = this;

    if (!Storage.hasPassword()) {
      self.toggle();
    } else {
      self.treeView.show();
    }
  }

  hide() {
    const self = this;

    self.treeView.hide();
  }

  configuration() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    let root = null;
    if (selected.length !== 0) {
      root = selected.view().getRoot();
    };

    if (self.configurationView == null) {
      self.configurationView = new ConfigurationView();
    }

    if (!Storage.hasPassword()) {
      self.promtPassword().then(() => {
        if (Storage.load()) {
          self.configurationView.reload(root);
          self.configurationView.attach();
        }
      });
      return;
    }

    self.configurationView.reload(root);
    self.configurationView.attach();
  }

  addTempToConfig() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    let root = null;
    if (selected.length !== 0) {
      root = selected.view().getRoot();
      root.config.temp = false;
      Storage.addServer(root.config);
      Storage.save();
    };
  }

  open(pending = false) {
    const self = this;
    const selected = self.treeView.list.find('.selected');

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

    // Check if file is already opened in texteditor
    if (getTextEditor(file.getLocalPath(true) + file.name, true)) {
      atom.workspace.open(file.getLocalPath(true) + file.name, { pending: pending, searchAllPanes: true })
      return false;
    }

    // Check if file is already in Queue
    if (Queue.existsFile(file.getLocalPath(true) + file.name)) {
      return false;
    }

    // Add sync icon
    file.addSyncIcon();

    // Create local Directories
    createLocalPath(file.getLocalPath(true) + file.name);

    // Add to Download Queue
    let queueItem = Queue.addFile({
      direction: "download",
      remotePath: file.getPath(true) + file.name,
      localPath: file.getLocalPath(true) + file.name,
      size: file.size
    });

    // Download file
    file.getConnector().downloadFile(queueItem).then(() => {
      // Remove sync icon
      file.removeSyncIcon();

      // Open file and add handler to editor to upload file on save
      return self.openFileInEditor(file, pending);
    }).catch((err) => {
      queueItem.changeStatus('Error');
      showMessage(err, 'error');

      // Remove sync icon
      file.removeSyncIcon();
    });
  }

  openDirectory(directory) {
    const self = this;

    directory.expand();
  }

  create(type) {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected.view().is('.file')) {
      directory = selected.view().parent;
    } else {
      directory = selected.view();
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

    const fullRelativePath = normalize('/' + directory.config.remote + '/' + relativePath);
    const fullLocalPath = normalize(directory.getRoot().getLocalPath(true) + relativePath, Path.sep);

    // create local file
    try {
      if (!FileSystem.existsSync(fullLocalPath)) {
        FileSystem.writeFileSync(fullLocalPath, '');
      }
    } catch (err) { }

    directory.getConnector().existsFile(fullRelativePath).then((result) => {
      showMessage('File ' + relativePath.trim() + ' already exists', 'error');
    }).catch((err) => {
      // Add to Upload Queue
      let queueItem = Queue.addFile({
        direction: "upload",
        remotePath: fullRelativePath,
        localPath: fullLocalPath,
        size: 0
      });

      return directory.getConnector().uploadFile(queueItem).then(() => {
        // Refresh cache
        directory.getRoot().getFinderCache().addFile(normalize(relativePath), 0);

        // Add to tree
        let element = self.treeView.addFile(directory.getRoot(), relativePath);
        if (element.isVisible()) {
          element.select();
        }

        // Open in editor
        self.openFile(element);
      }).catch((err) => {
        queueItem.changeStatus('Error');
        showMessage(err.message, 'error');
      });
    });
  }

  createDirectory(directory, relativePath) {
    const self = this;

    relativePath = trailingslashit(relativePath);
    const fullRelativePath = normalize('/' + directory.config.remote + '/' + relativePath);
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
        let element = self.treeView.addDirectory(directory.getRoot(), relativePath);
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
    const selected = self.treeView.list.find('.selected');

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

    const fullRelativePath = normalize('/' + file.config.remote + '/' + relativePath);
    const fullLocalPath = normalize(file.getRoot().getLocalPath(true) + relativePath, Path.sep);

    file.getConnector().rename(file.getPath(true) + file.name, fullRelativePath).then(() => {
      // Refresh cache
      file.getRoot().getFinderCache().renameFile(normalize(file.getPath(false) + file.name), normalize(relativePath), file.size);

      // Add to tree
      let element = self.treeView.addFile(file.getRoot(), relativePath, { size: file.size, rights: file.rights });
      if (element.isVisible()) {
        element.select();
      }

      // Check if file is already opened in texteditor
      let found = getTextEditor(file.getLocalPath(true) + file.name);
      if (found) {
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
    const fullRelativePath = normalize('/' + directory.config.remote + '/' + relativePath);
    const fullLocalPath = normalize(directory.getRoot().getLocalPath(true) + relativePath, Path.sep);

    directory.getConnector().rename(directory.getPath(), fullRelativePath).then(() => {
      // Refresh cache
      directory.getRoot().getFinderCache().renameDirectory(normalize(directory.getPath(false)), normalize(relativePath + '/'));

      // Add to tree
      let element = self.treeView.addDirectory(directory.getRoot(), relativePath, { rights: directory.rights });
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
    const selected = self.treeView.list.find('.selected');

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

    const fullRelativePath = normalize('/' + file.config.remote + '/' + relativePath);
    const fullLocalPath = normalize(file.getRoot().getLocalPath(true) + relativePath, Path.sep);

    file.getConnector().existsFile(fullRelativePath).then(() => {
      showMessage('File ' + relativePath.trim() + ' already exists', 'error');
    }).catch(() => {
      // Create local Directories
      createLocalPath(fullLocalPath);

      // Add to Download Queue
      let downloadQueueItem = Queue.addFile({
        direction: "download",
        remotePath: file.getPath(true) + file.name,
        localPath: fullLocalPath,
        size: file.size
      });

      // Download file
      file.getConnector().downloadFile(downloadQueueItem).then(() => {
        // Add to Upload Queue
        let uploadQueueItem = Queue.addFile({
          direction: "upload",
          remotePath: fullRelativePath,
          localPath: fullLocalPath,
          size: file.size
        });

        // Upload file
        file.getConnector().uploadFile(uploadQueueItem).then(() => {
          // Refresh cache
          file.getRoot().getFinderCache().addFile(normalize(relativePath), 0);

          // Add to tree
          let element = self.treeView.addFile(file.getRoot(), relativePath, { size: file.size, rights: file.rights });
          if (element.isVisible()) {
            element.select();
          }

          // Open file and add handler to editor to upload file on save
          return self.openFileInEditor(element);
        }).catch((err) => {
          uploadQueueItem.changeStatus('Error');
          showMessage(err.message, 'error');
        });
      }).catch((err) => {
        downloadQueueItem.changeStatus('Error');
        showMessage(err, 'error');
      });
    });
  }

  duplicateDirectory(directory, relativePath) {
    const self = this;

    const fullRelativePath = normalize('/' + directory.config.remote + '/' + relativePath);
    const fullLocalPath = normalize(directory.getRoot().getLocalPath(true) + relativePath, Path.sep);

    // TODO
  }

  delete() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected.view().is('.file')) {
      let file = selected.view();
      if (file) {
        atom.confirm({
          message: 'Are you sure you want to delete this file?',
          detailedMessage: "You are deleting:\n" + file.getPath(false) + file.name,
          buttons: {
            Yes: () => {
              self.deleteFile(file);
            },
            Cancel: () => {
              return true;
            }
          }
        });
      }
    } else if (selected.view().is('.directory')) {
      let directory = selected.view();
      if (directory) {
        atom.confirm({
          message: 'Are you sure you want to delete this folder?',
          detailedMessage: "You are deleting:\n" + trailingslashit(directory.getPath(false)),
          buttons: {
            Yes: () => {
              self.deleteDirectory(directory, true);
            },
            Cancel: () => {
              return true;
            }
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

  copy() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

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
    const selected = self.treeView.list.find('.selected');

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
    const selected = self.treeView.list.find('.selected');

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

      let find = self.treeView.list.find('#' + dataObject.id);
      if (!find) return;

      srcObject = find.view();
      if (!srcObject) return;

      if (srcObject.is('.directory')) {
        srcType = 'directory';
        srcPath = srcObject.getPath(false);
        destPath = destObject.getPath(false) + srcObject.name;
      } else {
        srcType = 'file';
        srcPath = srcObject.getPath(false) + srcObject.name;
        destPath = destObject.getPath(false) + srcObject.name;
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

      let find = self.treeView.list.find('#' + dataObject.id);
      if (!find) return;

      srcObject = find.view();
      if (!srcObject) return;

      if (srcObject.is('.directory')) {
        srcType = 'directory';
        srcPath = srcObject.getPath(false);
        destPath = destObject.getPath(false) + srcObject.name;
      } else {
        srcType = 'file';
        srcPath = srcObject.getPath(false) + srcObject.name;
        destPath = destObject.getPath(false) + srcObject.name;
      }

      // Check if copy/cut operation should be performed on the same server
      if (JSON.stringify(destObject.config) != JSON.stringify(srcObject.config)) return;

      window.sessionStorage.removeItem('ftp-remote-edit:cutPath');
      window.sessionStorage.removeItem('ftp-remote-edit:copyPath');
    } else {
      return;
    }

    if (handleEvent == "cut") {
      if (srcType == 'directory') self.moveDirectory(destObject, srcPath, destPath);
      if (srcType == 'file') self.moveFile(destObject, srcPath, destPath);
    } else if (handleEvent == "copy") {
      if (srcType == 'directory') self.copyDirectory(destObject, srcPath, destPath);
      if (srcType == 'file') self.copyFile(destObject, srcPath, destPath);
    }
  }

  drop(e) {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;
    if (!Storage.hasPassword()) return;

    let destObject = selected.view();
    if (destObject.is('.file')) {
      destObject = destObject.parent;
    }

    let initialPath, initialName, initialType, ref;
    if (entry = e.target.closest('.entry')) {
      e.preventDefault();
      e.stopPropagation();

      if (!destObject.is('.directory') && !destObject.is('.server')) {
        return;
      }

      let newDirectoryPath = destObject.getPath(false);
      if (!newDirectoryPath) {
        return false;
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

      if (normalize(initialPath) == normalize(newDirectoryPath)) return;

      if (initialPath) {
        // Drop event from Atom
        if (initialType == "directory") {
          newDirectoryPath += initialName + '/';
          self.moveDirectory(destObject, initialPath, newDirectoryPath);
        } else if (initialType == "file") {
          newDirectoryPath += initialName;
          self.moveFile(destObject, initialPath, newDirectoryPath);
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
          if (FileSystem.statSync(file.path).isDirectory()) {
            self.uploadDirectory(destObject, file.path, newDirectoryPath + basename(file.path, Path.sep));
          } else {
            self.uploadFile(destObject, file.path, newDirectoryPath + basename(file.path, Path.sep));
          }
        }
      }
    }
  }

  moveFile(directory, initialPath, newDirectoryPath) {
    const self = this;

    if (normalize(initialPath) == normalize(newDirectoryPath)) return;

    const src = normalize('/' + directory.config.remote + '/' + initialPath);
    const dest = normalize('/' + directory.config.remote + '/' + newDirectoryPath);

    directory.getConnector().existsFile(dest).then((result) => {
      return new Promise((resolve, reject) => {
        atom.confirm({
          message: 'File already exists. Are you sure you want to overwrite this file?',
          detailedMessage: "You are overwrite:\n" + newDirectoryPath.trim(),
          buttons: {
            Yes: () => {
              directory.getConnector().deleteFile(dest).then(() => {
                reject(true);
              }).catch((err) => {
                showMessage(err.message, 'error');
                resolve(false);
              });
            },
            Cancel: () => {
              resolve(false);
            }
          }
        });
      });
    }).catch(() => {
      directory.getConnector().rename(src, dest).then(() => {
        // get info from old object
        let oldObject = self.treeView.findElementByPath(directory.getRoot(), trailingslashit(initialPath));

        // Refresh cache
        directory.getRoot().getFinderCache().renameFile(normalize(src.replace(directory.getRoot().config.remote, '')), normalize(dest.replace(directory.getRoot().config.remote, '')), (oldObject) ? oldObject.size : 0);

        // Add to tree
        let element = self.treeView.addFile(directory.getRoot(), newDirectoryPath, { size: (oldObject) ? oldObject.size : null, rights: (oldObject) ? oldObject.rights : null });
        if (element.isVisible()) {
          element.select();
        }

        if (oldObject) {
          // Check if file is already opened in texteditor
          let found = getTextEditor(oldObject.getLocalPath(true) + oldObject.name);
          if (found) {
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

  moveDirectory(directory, initialPath, newDirectoryPath) {
    const self = this;

    initialPath = trailingslashit(initialPath);
    newDirectoryPath = trailingslashit(newDirectoryPath);

    if (normalize(initialPath) == normalize(newDirectoryPath)) return;

    const src = normalize('/' + directory.config.remote + '/' + initialPath);
    const dest = normalize('/' + directory.config.remote + '/' + newDirectoryPath);

    directory.getConnector().existsDirectory(dest).then((result) => {
      return new Promise((resolve, reject) => {
        atom.confirm({
          message: 'Directory already exists. Are you sure you want to overwrite this directory?',
          detailedMessage: "You are overwrite:\n" + newDirectoryPath.trim(),
          buttons: {
            Yes: () => {
              directory.getConnector().deleteDirectory(dest, recursive).then(() => {
                reject(true);
              }).catch((err) => {
                showMessage(err.message, 'error');
                resolve(false);
              });
            },
            Cancel: () => {
              resolve(false);
            }
          }
        });
      });
    }).catch(() => {
      directory.getConnector().rename(src, dest).then(() => {
        // get info from old object
        let oldObject = self.treeView.findElementByPath(directory.getRoot(), trailingslashit(initialPath));

        // Refresh cache
        directory.getRoot().getFinderCache().renameDirectory(normalize(initialPath), normalize(newDirectoryPath));

        // Add to tree
        let element = self.treeView.addDirectory(directory.getRoot(), newDirectoryPath, { size: (oldObject) ? oldObject.size : null, rights: (oldObject) ? oldObject.rights : null });
        if (element.isVisible()) {
          element.select();
        }

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

  copyFile(directory, initialPath, newDirectoryPath) {
    const self = this;

    // Rename file if exists
    if (normalize(initialPath) == normalize(newDirectoryPath)) {
      let filePath;
      let fileCounter = 0;
      let originalNewPath = normalize(newDirectoryPath);
      let parentPath = normalize('/' + directory.config.remote + '/' + dirname(newDirectoryPath));

      directory.getConnector().listDirectory(parentPath).then((list) => {
        let files = [];
        let fileList = list.filter((item) => {
          return item.type === '-';
        });

        fileList.forEach((element) => {
          files.push(element.name);
        });

        // append a number to the file if an item with the same name exists
        let extension = getFullExtension(originalNewPath);
        while (files.includes(basename(newDirectoryPath))) {
          extension = getFullExtension(originalNewPath);
          filePath = Path.dirname(originalNewPath) + '/' + Path.basename(originalNewPath, extension);
          newDirectoryPath = filePath + fileCounter + extension;
          fileCounter += 1;
        }

        self.copyFile(directory, initialPath, newDirectoryPath);
      }).catch((err) => {
        showMessage(err.message, 'error');
      });

      return;
    }

    const src = normalize('/' + directory.config.remote + '/' + initialPath);
    const dest = normalize('/' + directory.config.remote + '/' + newDirectoryPath);
    const srcLocalPath = normalize(directory.getRoot().getLocalPath(true) + initialPath, Path.sep);
    const destLocalPath = normalize(directory.getRoot().getLocalPath(true) + newDirectoryPath, Path.sep);
    let fileexists = false;

    // Create local Directories
    createLocalPath(srcLocalPath);
    createLocalPath(destLocalPath);

    directory.getConnector().existsFile(dest).then((result) => {
      return new Promise((resolve, reject) => {
        atom.confirm({
          message: 'File already exists. Are you sure you want to overwrite this file?',
          detailedMessage: "You are overwrite:\n" + newDirectoryPath.trim(),
          buttons: {
            Yes: () => {
              fileexists = true;
              reject(true);
            },
            Cancel: () => {
              resolve(false);
            }
          }
        });
      });
    }).catch(() => {
      // Add to Download Queue
      let downloadQueueItem = Queue.addFile({
        direction: "download",
        remotePath: src,
        localPath: srcLocalPath,
        size: 0
      });

      return directory.getConnector().downloadFile(downloadQueueItem).then(() => {
        // Get filesize
        let stats = FileSystem.statSync(srcLocalPath);

        // Add to Upload Queue
        let uploadQueueItem = Queue.addFile({
          direction: "upload",
          remotePath: dest,
          localPath: destLocalPath,
          size: stats.size
        });

        // create local file
        try {
          FileSystem.createReadStream(srcLocalPath).pipe(FileSystem.createWriteStream(destLocalPath));
        } catch (err) { console.log(srcLocalPath, destLocalPath, err); }

        return directory.getConnector().uploadFile(uploadQueueItem).then(() => {
          // Refresh cache
          directory.getRoot().getFinderCache().addFile(normalize(dest.replace(directory.getRoot().config.remote, '')), directory.size);

          if (!fileexists) {
            // Add to tree
            let element = self.treeView.addFile(directory.getRoot(), newDirectoryPath, { size: stats.size });
            if (element.isVisible()) {
              element.select();
            }
          }
        }).catch((err) => {
          uploadQueueItem.changeStatus('Error');
          showMessage(err.message, 'error');
        });

      }).catch((err) => {
        downloadQueueItem.changeStatus('Error');
        showMessage(err.message, 'error');
      });
    });
  }

  copyDirectory(directory, initialPath, newDirectoryPath) {
    const self = this;

    if (normalize(initialPath) == normalize(newDirectoryPath)) return;

    const src = normalize('/' + directory.config.remote + '/' + initialPath);
    const dest = normalize('/' + directory.config.remote + '/' + newDirectoryPath);

    // TODO
    console.log('TODO copy', src, dest);
  }

  uploadFile(directory, initialPath, newDirectoryPath) {
    const self = this;

    const fullRelativePath = normalize('/' + directory.config.remote + '/' + newDirectoryPath);
    const fullLocalPath = normalize(initialPath, Path.sep);
    let fileexists = false;

    directory.getConnector().existsFile(fullRelativePath).then((result) => {
      return new Promise((resolve, reject) => {
        atom.confirm({
          message: 'File already exists. Are you sure you want to overwrite this file?',
          detailedMessage: "You are overwrite:\n" + newDirectoryPath.trim(),
          buttons: {
            Yes: () => {
              fileexists = true;
              directory.getConnector().deleteFile(fullRelativePath).then(() => {
                reject(true);
              }).catch((err) => {
                showMessage(err.message, 'error');
                resolve(false);
              });
            },
            Cancel: () => {
              resolve(false);
            }
          }
        });
      });
    }).catch((err) => {
      let filestat = FileSystem.statSync(initialPath);

      // Add to Upload Queue
      let queueItem = Queue.addFile({
        direction: "upload",
        remotePath: fullRelativePath,
        localPath: fullLocalPath,
        size: filestat.size
      });

      return directory.getConnector().uploadFile(queueItem, 1).then(() => {
        if (!fileexists) {
          // Refresh cache
          directory.getRoot().getFinderCache().addFile(normalize(newDirectoryPath), filestat.size);

          // Add to tree
          let element = self.treeView.addFile(directory.getRoot(), newDirectoryPath, { size: filestat.size });
          if (element.isVisible()) {
            element.select();
          }
        } else {
          // Refresh cache
          directory.getRoot().getFinderCache().deleteFile(normalize(newDirectoryPath));
          directory.getRoot().getFinderCache().addFile(normalize(newDirectoryPath), filestat.size);
        }
      }).catch((err) => {
        queueItem.changeStatus('Error');
        showMessage(err.message, 'error');
      });
    });
  }

  uploadDirectory(directory, initialPath, newDirectoryPath) {
    const self = this;

    FileSystem.list(initialPath, (err, result) => {
      result.forEach((path, index) => {
        if (FileSystem.statSync(path).isDirectory()) {
          self.uploadDirectory(directory, path, normalize(newDirectoryPath + '/' + basename(path, Path.sep), '/'));
        } else {
          self.uploadFile(directory, path, normalize(newDirectoryPath + '/' + basename(path, Path.sep), '/'));
        }
      })
    });
  }

  chmod() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

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

  findRemotePath() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

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

        self.treeView.expand(root, relativePath).catch((err) => {
          showMessage(err, 'error');
        });

        dialog.close();
      }
    });
    dialog.attach();
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

  remotePathFinder(reindex = false) {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    let root = selected.view().getRoot();
    let itemsCache = root.getFinderCache();

    if (self.finderView == null) {
      self.finderView = new FinderView(self.treeView);

      self.finderView.on('ftp-remote-edit-finder:open', (item) => {
        let relativePath = item.relativePath;
        let localPath = normalize(self.finderView.root.getLocalPath() + relativePath, Path.sep);
        let file = self.treeView.getElementByLocalPath(localPath, self.finderView.root, 'file');
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
      if (self.treeView.isVisible()) {
        let editor = atom.workspace.getActiveTextEditor();

        if (editor && editor.getPath()) {
          let pathOnFileSystem = normalize(trailingslashit(editor.getPath()), Path.sep);

          let entry = self.treeView.findElementByLocalPath(pathOnFileSystem);
          if (entry && entry.isVisible()) {
            entry.select();
            self.treeView.remoteKeyboardNavigationMovePage();
          }
        }
      }
    }
  }

  openFileInEditor(file, pending) {
    const self = this;

    return atom.workspace.open(file.getLocalPath(true) + file.name, { pending: pending, searchAllPanes: true }).then((editor) => {
      if (file.editor === null || file.editor === undefined) {
        editor.saveObject = file;

        // Save file on remote server
        try {
          editor.onDidSave((saveObject) => {
            if (!editor.saveObject) return;

            // Get filesize
            let filestat = FileSystem.statSync(editor.getPath(true));
            editor.saveObject.size = filestat.size;
            editor.saveObject.attr('data-size', filestat.size);

            let pathOnFileSystem = normalize(trailingslashit(editor.getPath()), Path.sep);
            let foundInTreeView = self.treeView.findElementByLocalPath(pathOnFileSystem);
            if (foundInTreeView) {
              // Add sync icon
              foundInTreeView.addSyncIcon();
            }

            // Add to Upload Queue
            let queueItem = Queue.addFile({
              direction: "upload",
              remotePath: editor.saveObject.getPath(true) + editor.saveObject.name,
              localPath: editor.saveObject.getLocalPath(true) + editor.saveObject.name,
              size: editor.saveObject.size
            });

            // Upload file
            editor.saveObject.getConnector().uploadFile(queueItem).then(() => {
              if (atom.config.get('ftp-remote-edit.notifications.showNotificationOnUpload')) {
                showMessage('File successfully uploaded.', 'success');
              }

              if (foundInTreeView) {
                // Remove sync icon
                foundInTreeView.removeSyncIcon();
              }
            }).catch((err) => {
              queueItem.changeStatus('Error');
              showMessage(err.message, 'error');

              if (foundInTreeView) {
                // Remove sync icon
                foundInTreeView.removeSyncIcon();
              }
            });
          });

          editor.onDidDestroy(() => { });
        } catch (err) { }
      }
    }).catch((err) => {
      showMessage(err.message, 'error');

      // Remove sync icon
      file.removeSyncIcon();
    });
  }
}

export default new FtpRemoteEdit();
