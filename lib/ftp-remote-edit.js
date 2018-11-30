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

import { $ } from 'atom-space-pen-views';
import { CompositeDisposable, Disposable, TextEditor } from 'atom';
import { decrypt, encrypt, checkPasswordExists, checkPassword, setPassword, changePassword } from './helper/secure.js';
import { basename, dirname, trailingslashit, normalize, permissionsToRights } from './helper/format.js';
import { getFullExtension, createLocalPath, deleteLocalPath, isPathIgnored, getTextEditor } from './helper/helper.js';

const config = require('./config/config-schema.json');

const atom = global.atom;
const Path = require('path');
const FileSystem = require('fs-plus');
const getIconServices = require('./helper/icon.js');
const Queue = require('./helper/queue.js');

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
      'ftp-remote-edit:edit-servers': () => self.configuration(),
      'ftp-remote-edit:change-password': () => self.changePassword(),
      'ftp-remote-edit:open-file': () => self.open('file'),
      'ftp-remote-edit:open-file-pending': () => self.open('file', true),
      'ftp-remote-edit:new-file': () => self.create('file'),
      'ftp-remote-edit:new-directory': () => self.create('directory'),
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

    self.listeners.dispose();
    self.treeView.destroy();
  }

  serialize() {
    return {};
  }

  handleURI(parsedUri) {
    const self = this;

    let regex = /(\/)?([a-z0-9_\-]{1,5}:\/\/)(([^:]{1,})((:(.{1,}))?[\@\x40]))?([a-z0-9_\-.]+)(:([0-9]*))?/gi;
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

        changePassword(oldPasswordValue, passwords.newPassword).then(() => {
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
        self.changePassword('add').then((returnValue) => {
          if (returnValue) {
            if (self.treeView.loadServers(self.info.password)) {
              self.treeView.reload();
              self.treeView.toggle();
            }
          }
        });
        return;
      } else {
        self.promtPassword().then(() => {
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

  configuration() {
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
      self.promtPassword(true).then(() => {
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

  open(type, pending = false) {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected) {
      if (type == 'file') {
        if (selected.view().is('.file')) {
          let file = selected.view();
          if (file) {
            self.openFile(file, pending);
          }
        }
      } else if (type == 'directory') {
        if (selected.view().is('.directory')) {
          let directory = selected.view();
          if (directory) {
            self.openDirectory(directory);
          }
        }
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
    file.addSyncFileIcon();

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
    file.getRoot().connector.downloadFile(queueItem).then(() => {
      // Remove sync icon
      file.removeSyncFileIcon();

      // Open file in texteditor
      return atom.workspace.open(file.getLocalPath(true) + file.name, { pending: pending, searchAllPanes: true }).then((editor) => {
        if (file.editor === null || file.editor === undefined) {
          file.editor = editor;
          editor.saveObject = file;

          // Save file on remote server
          try {
            editor.onDidSave((saveObject) => {
              if (!editor.saveObject) return;

              // Get filesize
              FileSystem.stat(editor.getPath(true), (err, stats) => {
                if (stats) {
                  editor.saveObject.size = stats.size;
                  editor.saveObject.attr('data-size', stats.size);
                }
              });

              let parentPath = ('/' + trailingslashit(editor.saveObject.getPath(false) + editor.saveObject.name)).replace(/\/+/g, "/");

              foundInTreeView = file.getRoot().find(parentPath);
              if (foundInTreeView) {
                foundInTreeView = foundInTreeView.view();

                // Add sync icon
                foundInTreeView.addSyncFileIcon();
              }

              // Add to Upload Queue
              let queueItem = Queue.addFile({
                direction: "upload",
                remotePath: editor.saveObject.getPath(true) + editor.saveObject.name,
                localPath: editor.saveObject.getLocalPath(true) + editor.saveObject.name,
                size: editor.saveObject.size
              });

              // Upload file
              editor.saveObject.getRoot().connector.uploadFile(queueItem).then(() => {
                if (atom.config.get('ftp-remote-edit.notifications.showNotificationOnUpload')) {
                  editor.saveObject.getRoot()
                    .connector.showMessage('File successfully uploaded.', 'success');
                }

                if (foundInTreeView) {
                  // Remove sync icon
                  foundInTreeView.removeSyncFileIcon();
                }
              }).catch((err) => {
                queueItem.changeStatus('Error');
                editor.saveObject.getRoot()
                  .connector.showMessage(err.message, 'error');

                if (foundInTreeView) {
                  // Remove sync icon
                  foundInTreeView.removeSyncFileIcon();
                }
              });
            });

            editor.onDidDestroy(() => {
              file.editor = null;
            });
          } catch (err) {}
        }
      }).catch((err) => {
        file.getRoot().connector.showMessage(err.message, 'error');

        // Remove sync icon
        file.removeSyncFileIcon();
      });
    }).catch((err) => {
      queueItem.changeStatus('Error');
      file.getRoot().connector.showMessage(err, 'error');

      // Remove sync icon
      file.removeSyncFileIcon();
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

    if (selected) {
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
  }

  createFile(directory, relativePath) {
    const self = this;

    let fullRelativePath = ('/' + directory.config.remote + '/' + relativePath).replace(/\/+/g, "/");
    let fullLocalPath = (directory.getRoot().getLocalPath(true) + relativePath.replace(/^\//, "").replace(/\/+/g, Path.sep)).replace(/\/+/g, Path.sep);

    // Add to Upload Queue
    let queueItem = Queue.addFile({
      direction: "upload",
      remotePath: fullRelativePath,
      localPath: fullLocalPath,
      size: 0
    });

    // create local file
    try {
      if (!FileSystem.existsSync(fullLocalPath)) {
        FileSystem.writeFileSync(fullLocalPath, '');
      }
    } catch (err) {}

    directory.getRoot().connector.existsFile(fullRelativePath.trim()).then((result) => {
      directory.getRoot().connector.showMessage('File ' + relativePath.trim() + ' already exists', 'error');
    }).catch((err) => {
      return directory.getRoot().connector.uploadFile(queueItem).then(() => {
        // Refresh cache
        directory.getRoot().getFinderItemsCache().addFile(relativePath, 0);

        let parentPath = normalize('/' + trailingslashit(dirname(relativePath)));
        let parentObject = null;

        if (parentPath == '/') {
          parentObject = directory.getRoot();
        } else {
          parentObject = directory.getRoot().find(parentPath);
          if (parentObject) {
            parentObject = parentObject.view();
          }
        }

        if (parentObject) {
          let elementname = basename(relativePath);
          let pathOnFileSystem = normalize(parentObject.getLocalPath(true) + elementname, Path.sep);
          let newObject = new FileView(parentObject, {
            name: elementname,
            path: pathOnFileSystem,
            size: 0,
            rights: null
          });

          parentObject.entries.append(newObject);

          if (parentObject.isExpanded) {
            parentObject.refresh(parentObject)
            newObject.select();
          }
          self.openFile(newObject);
        }
      }).catch((err) => {
        queueItem.changeStatus('Error');
        directory.getRoot().connector.showMessage(err.message, 'error');
      });
    });
  }

  createDirectory(directory, relativePath) {
    const self = this;

    let fullRelativePath = ('/' + directory.config.remote + '/' + relativePath).replace(/\/+/g, "/");

    directory.getRoot().connector.existsDirectory(fullRelativePath.trim()).then((result) => {
      directory.getRoot().connector.showMessage('Directory ' + relativePath.trim() + ' already exists', 'error');
    }).catch((err) => {
      return directory.getRoot().connector.createDirectory(fullRelativePath.trim()).then((result) => {
        let parentPath = normalize('/' + trailingslashit(dirname(relativePath)));
        let parentObject = null;

        if (parentPath == '/') {
          parentObject = directory.getRoot();
        } else {
          parentObject = directory.getRoot().find(parentPath);
          if (parentObject) {
            parentObject = parentObject.view();
          }
        }

        if (parentObject) {
          let elementname = basename(relativePath);
          let pathOnFileSystem = normalize(parentObject.getLocalPath(true) + elementname, Path.sep);
          let newObject = new DirectoryView(parentObject, {
            name: elementname,
            path: pathOnFileSystem,
            rights: null
          });

          parentObject.entries.append(newObject);

          if (parentObject.isExpanded) {
            parentObject.refresh(parentObject)
            newObject.select();
          }
        }
      }).catch((err) => {
        directory.getRoot().connector.showMessage(err.message, 'error');
      });
    });
  }

  rename() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected) {
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
  }

  renameFile(file, relativePath) {
    const self = this;

    const fullRelativePath = ('/' + file.config.remote + '/' + relativePath).replace(/\/+/g, "/");
    const fullLocalPath = (file.getRoot().getLocalPath(true) + relativePath.replace(/^\//, "").replace(/\/+/g, Path.sep)).replace(/\/+/g, Path.sep);

    file.getRoot().connector.rename(file.getPath(true) + file.name, fullRelativePath.trim()).then(() => {
      // Refresh cache
      file.getRoot().getFinderItemsCache().renameFile(file.getPath(false) + file.name, relativePath, file.size);

      // get info from old object
      let oldObject = file;

      // Add new object
      let parentPath = ('/' + trailingslashit(dirname(relativePath))).replace(/\/+/g, "/");
      let parentObject = null;

      if (parentPath == '/') {
        parentObject = file.getRoot();
      } else {
        parentObject = file.getRoot().find(parentPath);
        if (parentObject) {
          parentObject = parentObject.view();
        }
      }

      if (parentObject) {
        let elementname = basename(relativePath);
        let pathOnFileSystem = normalize(parentObject.getPath() + elementname, Path.sep);
        let newObject = new FileView(parentObject, {
          name: elementname,
          path: pathOnFileSystem,
          size: oldObject.size,
          rights: oldObject.rights
        });

        parentObject.entries.append(newObject);

        if (parentObject.isExpanded) {
          parentObject.refresh(parentObject)
          newObject.select();
        }

        // Check if file is already opened in texteditor
        let found = null;
        found = getTextEditor(oldObject.getLocalPath(true) + oldObject.name);

        if (found) {
          found.saveObject = newObject;
          found.saveAs(newObject.getLocalPath(true) + newObject.name);
        }
      } else {
        let newObject = file.getElementByLocalPath(fullLocalPath);

        // Check if file is already opened in texteditor
        let found = null;
        found = getTextEditor(oldObject.getLocalPath(true) + oldObject.name);

        if (found) {
          found.saveObject.destroy();
          found.saveObject = null;
          if (oldObject) newObject.size = oldObject.size;
          found.saveObject = newObject;
        }
      }

      // Move local file
      let initialPath = oldObject.getLocalPath(true) + oldObject.name;
      let arrPath = fullLocalPath.split(Path.sep);
      arrPath.pop();
      let newDirectoryPath = arrPath.join(Path.sep);
      let newPath = fullLocalPath;

      try {
        if (!FileSystem.existsSync(newDirectoryPath)) {
          FileSystem.makeTreeSync(newDirectoryPath);
        }
        if (FileSystem.existsSync(newPath)) {
          FileSystem.removeSync(newPath);
        }
        FileSystem.moveSync(initialPath, newPath);
      } catch (_error) {}

      // Remove old object
      if (oldObject) oldObject.remove()
    }).catch((err) => {
      file.getRoot().connector.showMessage(err.message, 'error');
    });
  }

  renameDirectory(directory, relativePath) {
    const self = this;

    const fullRelativePath = ('/' + directory.config.remote + '/' + relativePath).replace(/\/+/g, "/");

    directory.getRoot().connector.rename(directory.getPath(), fullRelativePath.trim()).then(() => {
      // Refresh cache
      directory.getRoot().getFinderItemsCache().renameDirectory(directory.getPath(false), relativePath + '/');

      // get info from old object
      let oldObject = directory;
      let dirinfo = {
        size: 0,
        rights: null
      };

      if (oldObject) {
        dirinfo.rights = oldObject.rights;
      }

      // Add new object
      let parentPath = ('/' + trailingslashit(dirname(relativePath))).replace(/\/+/g, "/");
      let parentObject = null;

      if (parentPath == '/') {
        parentObject = directory.getRoot();
      } else {
        parentObject = directory.getRoot().find(parentPath);
        if (parentObject) {
          parentObject = parentObject.view();
        }
      }

      if (parentObject) {
        let elementname = basename(relativePath);
        let pathOnFileSystem = normalize(parentObject.getLocalPath(true) + elementname, Path.sep);
        let newObject = new DirectoryView(parentObject, {
          name: elementname,
          path: pathOnFileSystem,
          rights: dirinfo.rights
        });

        parentObject.entries.append(newObject);

        if (parentObject.isExpanded) {
          parentObject.refresh(parentObject)
          newObject.select();
        }
      }

      // Remove old object
      if (oldObject) oldObject.remove()
    }).catch((err) => {
      directory.getRoot().connector.showMessage(err.message, 'error');
    });
  }

  delete() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected) {
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
  }

  deleteFile(file) {
    const self = this;

    file.getRoot().connector.deleteFile(file.getPath(true) + file.name).then(() => {
      // Refresh cache
      file.getRoot().getFinderItemsCache().deleteFile(file.getPath(false) + file.name);

      // Delete local file
      const fullLocalPath = (file.getLocalPath(true) + file.name.replace(/^\//, "").replace(/\/+/g, Path.sep)).replace(/\/+/g, Path.sep);
      try {
        if (FileSystem.existsSync(fullLocalPath)) {
          FileSystem.unlinkSync(fullLocalPath);
        }
      } catch (err) {}

      file.destroy();
    }).catch((err) => {
      file.getRoot().connector.showMessage(err.message, 'error');
    });
  }

  deleteDirectory(directory, recursive) {
    const self = this;

    directory.getRoot().connector.deleteDirectory(directory.getPath(), recursive).then(() => {
      // Refresh cache
      directory.getRoot().getFinderItemsCache().deleteDirectory(directory.getPath(false));

      const fullLocalPath = (directory.getLocalPath(true)).replace(/\/+/g, Path.sep);

      // Delete local directory
      deleteLocalPath(fullLocalPath);

      directory.destroy();
    }).catch((err) => {
      directory.getRoot().connector.showMessage(err.message, 'error');
    });
  }

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

    let srcType = null;
    let srcPath = null;
    let destPath = null;

    // Parse data from copy/cut/drag event
    if (window.sessionStorage['ftp-remote-edit:cutPath']) {
      // Cut event from Atom
      handleEvent = "cut";

      let cutObjectString = decrypt(self.info.password, window.sessionStorage['ftp-remote-edit:cutPath']);
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

      let copiedObjectString = decrypt(self.info.password, window.sessionStorage['ftp-remote-edit:copyPath']);
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
    } else if (window.sessionStorage['ftp-remote-edit:dragPath']) {
      // Drag/Drop event from Atom
      handleEvent = "drag";

      srcType = window.sessionStorage['ftp-remote-edit:dragType'];
      srcPath = window.sessionStorage['ftp-remote-edit:dragPath'];
      destPath = window.sessionStorage['ftp-remote-edit:dropPath'];

      console.log(srcType, srcPath, destPath);

      window.sessionStorage.removeItem('ftp-remote-edit:dragPath');
      window.sessionStorage.removeItem('ftp-remote-edit:dragName');
      window.sessionStorage.removeItem('ftp-remote-edit:dragType');
    } else if (window.sessionStorage['ftp-remote-edit:dragFiles']) {
      // Drag/Drop event from OS
      handleEvent = "upload";

      console.log(window.sessionStorage['ftp-remote-edit:dragFiles']);
      window.sessionStorage.removeItem('ftp-remote-edit:dragFiles');

      // TODO

      return;
    } else {
      return;
    }

    if (handleEvent == "cut") {
      if (srcType == 'directory') self.moveDirectory(destObject, srcPath, destPath);
      if (srcType == 'file') self.moveFile(destObject, srcPath, destPath);
    } else if (handleEvent == "copy") {
      if (srcType == 'directory') self.copyDirectory(destObject, srcPath, destPath);
      if (srcType == 'file') self.copyFile(destObject, srcPath, destPath);
    } else if (handleEvent == "drag") {
      if (srcType == 'directory') self.moveDirectory(destObject, srcPath, destPath);
      if (srcType == 'file') self.moveFile(destObject, srcPath, destPath);
    } else if (handleEvent == "upload") {
      // TODO
    }
  }

  moveFile(directory, initialPath, newDirectoryPath) {
    const self = this;

    if (initialPath.trim() == newDirectoryPath.trim()) return;

    let src = (((directory.config.remote) ? '/' + directory.config.remote + '/' : '/') + initialPath).replace(/\/+/g, "/");
    let dest = (((directory.config.remote) ? '/' + directory.config.remote + '/' : '/') + newDirectoryPath).replace(/\/+/g, "/");

    // get info from old object
    let oldObject = directory.getRoot().find(trailingslashit(initialPath));
    let fileinfo = {
      size: 0,
      rights: null,
      content: "",
      exists: false
    };

    if (oldObject) {
      oldObject = oldObject.view();
      fileinfo.size = oldObject.size;
      fileinfo.rights = oldObject.rights;
    }

    directory.getRoot().connector.existsFile(dest.trim()).then((result) => {
      return new Promise((resolve, reject) => {
        atom.confirm({
          message: 'File already exists. Are you sure you want to overwrite this file?',
          detailedMessage: "You are overwrite:\n" + newDirectoryPath.trim(),
          buttons: {
            Yes: () => {
              fileinfo.exists = true;
              directory.getRoot().connector.deleteFile(dest.trim()).then(() => {
                reject(true);
              }).catch((err) => {
                directory.getRoot().connector.showMessage(err.message, 'error');
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
      // add sync icon
      if (oldObject) {
        oldObject.label.addClass('icon-sync').addClass('spin');
      }

      directory.getRoot().connector.rename(src.trim(), dest.trim()).then(() => {
        // Refresh cache
        directory.getRoot().getFinderItemsCache().renameFile(src.replace(directory.getRoot().config.remote, ''), dest.replace(directory.getRoot().config.remote, ''), fileinfo.size);

        // Add new object
        let elementname = basename(dest);
        let pathOnFileSystem = normalize(directory.getPath() + elementname, Path.sep);
        let newObject = new FileView(directory, {
          name: elementname,
          path: pathOnFileSystem,
          size: fileinfo.size,
          rights: fileinfo.rights
        });

        if (!fileinfo.exists) {
          directory.entries.append(newObject);
          if (directory.isExpanded) {
            directory.refresh(directory)
            newObject.select();
          }
        }

        // Check if file is already opened
        let found = null;
        texteditors = atom.workspace.getTextEditors();
        texteditors.forEach((texteditor) => {
          if (texteditor.getPath() == oldObject.getLocalPath(true) + oldObject.name) {
            found = texteditor;
            return false;
          }
        });

        if (found) {
          found.saveObject = newObject;
          found.saveAs(newObject.getLocalPath(true) + newObject.name);
        }

        // Move local file
        let initialPath = oldObject.getLocalPath(true) + oldObject.name;
        let arrPath = newObject.getLocalPath().split(Path.sep);
        arrPath.pop();
        let newDirectoryPath = arrPath.join(Path.sep);
        let newPath = newObject.getLocalPath(true) + newObject.name;

        try {
          if (!FileSystem.existsSync(newDirectoryPath)) {
            FileSystem.makeTreeSync(newDirectoryPath);
          }
          if (FileSystem.existsSync(newPath)) {
            FileSystem.removeSync(newPath);
          }
          FileSystem.moveSync(initialPath, newPath);
        } catch (_error) {}

        // Remove old object
        if (oldObject) {
          oldObject.remove();
        }
      }).catch((err) => {
        if (oldObject) {
          oldObject.label.removeClass('icon-sync').removeClass('spin');
        }
        directory.getRoot().connector.showMessage(err.message, 'error');
      });
    });
  }

  moveDirectory(directory, initialPath, newDirectoryPath) {
    const self = this;

    if (initialPath.trim() == newDirectoryPath.trim()) return;

    let src = (((directory.config.remote) ? '/' + directory.config.remote + '/' : '/') + initialPath).replace(/\/+/g, "/");
    let dest = (((directory.config.remote) ? '/' + directory.config.remote + '/' : '/') + newDirectoryPath).replace(/\/+/g, "/");

    // get info from old object
    let oldObject = directory.getRoot().find(trailingslashit(initialPath + '/'));
    let dirinfo = {
      size: 0,
      rights: null
    };

    if (oldObject) {
      oldObject = oldObject.view();
      oldObject.label.addClass('icon-sync').addClass('spin');
      dirinfo.rights = oldObject.rights;
    }

    directory.getRoot().connector.rename(src.trim(), dest.trim()).then(() => {
      // Refresh cache
      directory.getRoot().getFinderItemsCache().renameDirectory(initialPath, newDirectoryPath);

      // Add new object
      let elementname = basename(dest);
      let pathOnFileSystem = normalize(directory.getPath() + elementname, Path.sep);
      let newObject = new DirectoryView(directory, {
        name: elementname,
        path: pathOnFileSystem,
        rights: dirinfo.rights
      });

      directory.entries.append(newObject);

      if (directory.isExpanded) {
        directory.refresh(directory)
        newObject.select();
      }

      // Remove old object
      if (oldObject) oldObject.remove();
    }).catch((err) => {
      if (oldObject) {
        oldObject.label.removeClass('icon-sync').removeClass('spin');
      }
      directory.getRoot().connector.showMessage(err.message, 'error');
    });
  }

  copyFile(directory, initialPath, newDirectoryPath) {
    const self = this;

    // Rename file if exists
    if (initialPath.trim() == newDirectoryPath.trim()) {
      let filePath;
      let fileCounter = 0;
      let originalNewPath = newDirectoryPath.trim();
      let parentPath = dirname((((directory.config.remote) ? '/' + directory.config.remote + '/' : '/') + newDirectoryPath).replace(/\/+/g, "/"));

      directory.getRoot().connector.listDirectory(parentPath).then((list) => {
        let files = [];
        let fileList = list.filter((item) => {
          return item.type === '-';
        });

        fileList.forEach((element) => {
          files.push(element.name);
        });

        // append a number to the file if an item with the same name exists
        let extension = getFullExtension(originalNewPath);
        while (files.includes(Path.basename(newDirectoryPath))) {
          extension = getFullExtension(originalNewPath);
          filePath = dirname(originalNewPath) + Path.basename(originalNewPath, extension);
          newDirectoryPath = filePath + fileCounter + extension;
          fileCounter += 1;
        }
        directory.copyFile(initialPath, newDirectoryPath);
      }).catch((err) => {
        directory.getRoot().connector.showMessage(err.message, 'error');
      });

      return;
    }

    let src = (((directory.config.remote) ? '/' + directory.config.remote + '/' : '/') + initialPath).replace(/\/+/g, "/");
    let dest = (((directory.config.remote) ? '/' + directory.config.remote + '/' : '/') + newDirectoryPath).replace(/\/+/g, "/");

    let srcLocalPath = (directory.getRoot().getLocalPath(true) + initialPath.replace(/^\//, "").replace(/\/+/g, Path.sep)).replace(/\/+/g, Path.sep);
    let destLocalPath = (directory.getRoot().getLocalPath(true) + newDirectoryPath.replace(/^\//, "").replace(/\/+/g, Path.sep)).replace(/\/+/g, Path.sep);

    let fileinfo = {
      size: 0,
      rights: null,
      content: "",
      exists: false
    };

    // Create local Directories
    createLocalPath(srcLocalPath);
    createLocalPath(destLocalPath);

    directory.getRoot().connector.existsFile(dest.trim()).then((result) => {
      return new Promise((resolve, reject) => {
        atom.confirm({
          message: 'File already exists. Are you sure you want to overwrite this file?',
          detailedMessage: "You are overwrite:\n" + newDirectoryPath.trim(),
          buttons: {
            Yes: () => {
              fileinfo.exists = true;
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
      let download_queueItem = Queue.addFile({
        direction: "download",
        remotePath: src,
        localPath: srcLocalPath,
        size: 0
      });

      return directory.getRoot().connector.downloadFile(download_queueItem).then(() => {
        // Get filesize
        FileSystem.stat(srcLocalPath, (err, stats) => {
          if (stats) {
            fileinfo.size = stats.size;

            // Add to Upload Queue
            let upload_queueItem = Queue.addFile({
              direction: "upload",
              remotePath: dest,
              localPath: destLocalPath,
              size: fileinfo.size
            });

            // create local file
            try {
              FileSystem.createReadStream(srcLocalPath).pipe(FileSystem.createWriteStream(destLocalPath));
            } catch (err) { console.log(srcLocalPath, destLocalPath, err); }

            return directory.getRoot().connector.uploadFile(upload_queueItem).then(() => {
              // Refresh cache
              directory.getRoot().getFinderItemsCache().addFile(dest.replace(directory.getRoot().config.remote, ''), directory.size);

              if (!fileinfo.exists) {
                // Add new object
                let elementname = basename(dest);
                let newObject = new FileView(directory, {
                  name: elementname,
                  path: destLocalPath,
                  size: fileinfo.size,
                  rights: fileinfo.rights
                });

                directory.entries.append(newObject);

                if (directory.isExpanded) {
                  directory.refresh(directory)
                  newObject.select();
                }
              }
            }).catch((err) => {
              upload_queueItem.changeStatus('Error');
              directory.getRoot().connector.showMessage(err.message, 'error');
            });
          } else if (err) {
            directory.getRoot().connector.showMessage(err.message, 'error');
          }
        });
      }).catch((err) => {
        download_queueItem.changeStatus('Error');
        directory.getRoot().connector.showMessage(err.message, 'error');
      });
    });
  }

  copyDirectory(directory, initialPath, newDirectoryPath) {
    const self = this;

    if (initialPath.trim() == newDirectoryPath.trim()) return;

    let src = (((directory.config.remote) ? '/' + directory.config.remote + '/' : '/') + initialPath).replace(/\/+/g, "/");
    let dest = (((directory.config.remote) ? '/' + directory.config.remote + '/' : '/') + newDirectoryPath).replace(/\/+/g, "/");

    // TODO
    console.log('TODO copy', src, dest);
  }

  uploadFile(initialPath, newDirectoryPath) {
    const self = this;

    // TODO
    console.log('TODO upload file', initialPath, newDirectoryPath);
  }

  uploadDirectory(initialPath, newDirectoryPath) {
    const self = this;

    // TODO
    console.log('TODO upload directoy', initialPath, newDirectoryPath);
  }

  chmod() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    if (selected) {
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
  }

  chmodFile(file, permissions) {
    const self = this;

    file.getRoot().connector.chmodFile(file.getPath(true) + file.name, permissions).then((responseText) => {
      file.rights = permissionsToRights(permissions);
    }).catch((err) => {
      file.getRoot().connector.showMessage(err.message, 'error');
    });
  }

  chmodDirectory(directory, permissions) {
    const self = this;

    directory.getRoot().connector.chmodDirectory(directory.getPath(true), permissions).then((responseText) => {
      directory.rights = permissionsToRights(permissions);
    }).catch((err) => {
      directory.getRoot().connector.showMessage(err.message, 'error');
    });
  }

  findRemotePath() {
    const self = this;
    const selected = self.treeView.list.find('.selected');

    if (selected.length === 0) return;

    const dialog = new FindDialog('/', false);
    dialog.on('find-path', (e, relativePath) => {
      if (relativePath) {
        relativePath = relativePath.replace(/\/+/g, "/");

        let root = null;
        root = selected.view().getRoot();

        // Remove initial path if exists
        if (root.config.remote) {
          if (relativePath.startsWith(root.config.remote)) {
            relativePath = relativePath.replace(root.config.remote, "");
          }
        }

        root.expandPath(relativePath, true).catch((err) => {
          root.connector.showMessage(err, 'error');
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

  autoRevealActiveFile(treeView) {
    const self = this;

    if (atom.config.get('ftp-remote-edit.tree.autoRevealActiveFile')) {
      if (treeView && treeView.isVisible()) {
        let editor = atom.workspace.getActiveTextEditor();

        if (editor && editor.getPath()) {
          let pathOnFileSystem = normalize(trailingslashit(editor.getPath()), Path.sep);

          let entry = treeView.findElementByLocalPath(pathOnFileSystem);
          if (entry) {
            entry.select();
          };
        }
      }
    }
  }
}

export default new FtpRemoteEdit();
