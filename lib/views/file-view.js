'use babel';

import Connector from './../connectors/connector.js';
import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';
import { basename, dirname, trailingslashit, normalize, permissionsToRights } from './../helper/format.js';
import { getFullExtension, createLocalPath } from './../helper/helper.js';
import DirectoryView from './directory-view.js';
import ServerView from './server-view.js';

const md5 = require('md5');
const Path = require('path');
const FileSystem = require('fs-plus');
const Queue = require('./../helper/queue.js');
const getIconServices = require('./../helper/icon.js');

class FileView extends View {

  FileView() {
    super.FileView();

    const self = this;

    self.id = null;
    self.parent = null;
    self.config = null;
    self.name = null;
    self.size = null;
    self.rights = null;
  }

  static content() {
    return this.li({
      class: 'file entry list-item',
    }, () => this.span({
      class: 'name icon',
      outlet: 'label',
    }));
  };

  serialize() {
    const self = this;

    return {
      id: self.id,
      config: self.config,
      name: self.name,
      size: self.size,
      rights: self.rights,
      path: self.getPath(false),
    };
  }

  initialize(parent, file) {
    const self = this;

    self.parent = parent;
    self.config = parent.config;
    self.name = file.name;
    self.size = file.size;
    self.rights = file.rights;
    self.id = self.getId();

    // Add filename
    self.label.text(self.name);

    // Add file icon
    getIconServices().updateFileIcon(self);

    self.attr('data-name', self.name);
    self.attr('data-host', self.config.host);
    self.attr('data-size', self.size);
    self.attr('id', self.id);

    // Events
    self.on('click', function (e) {
      e.stopPropagation();
      if (atom.config.get('ftp-remote-edit.tree.allowPendingPaneItems')) {
        self.open(true);
      }
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();
      self.open();
    });

    // Drag & Drop
    self.on('dragstart', (e) => self.onDragStart(e));
  };

  destroy() {
    this.remove();
  };

  getId() {
    const self = this;

    return 'ftp-remote-edit-' + md5(self.getPath(false) + self.name);
  }

  getRoot() {
    const self = this;

    if (self.parent) {
      return self.parent.getRoot();
    }
    return self;
  }

  getPath(useRemote = true) {
    const self = this;

    return self.parent.getPath(useRemote);
  }

  getLocalPath(useRemote = true) {
    const self = this;

    return self.parent.getLocalPath(useRemote)
      .replace(/\/+/g, Path.sep);
  }

  getElementByLocalPath(pathOnFileSystem) {
    const self = this;

    let elementname = basename(pathOnFileSystem, Path.sep);
    let elementpath = dirname(pathOnFileSystem, Path.sep) + elementname;
    let dirpath = dirname(pathOnFileSystem, Path.sep);
    let elementsize = 0;

    let elementparent = self.getRoot()
      .treeView.getElementByLocalPath(dirpath, self.getRoot());
    if (!elementparent) return null;

    // Get filesize
    FileSystem.stat(elementpath, function (err, stats) {
      if (stats) {
        let element = new FileView(elementparent, {
          name: elementname,
          path: elementpath,
          size: stats.size,
          rights: null
        });
      } else {
        let element = new FileView(elementparent, {
          name: elementname,
          path: elementpath,
          size: 0,
          rights: null
        });
      }
    });

    return element;
  }

  getTextEditor(pathOnFileSystem, activate = false) {
    let foundEditor = null;
    texteditors = atom.workspace.getTextEditors();
    texteditors.forEach((texteditor) => {
      if (texteditor.getPath() == pathOnFileSystem) {
        foundEditor = texteditor;
        return false;
      }
    });

    if (activate && foundEditor) {
      pane = atom.workspace.paneForItem(foundEditor);
      if (pane) pane.activateItem(foundEditor);
    }

    return foundEditor;
  }

  addSyncFileIcon(element = null) {
    const self = this;

    if (!element) element = self;
    if (!element.label) return;

    element.label.addClass('icon-sync').addClass('spin');
  };

  removeSyncFileIcon(element = null) {
    const self = this;

    if (!element) element = self;
    if (!element.label) return;

    element.label.removeClass('icon-sync').removeClass('spin');
  };

  open(pending = false) {
    const self = this;

    let queueItem = null;

    // Check if file is already opened in texteditor
    if (self.getTextEditor(self.getLocalPath(true) + self.name, true)) {
      atom.workspace.open(self.getLocalPath(true) + self.name, { pending: pending, searchAllPanes: true })
      return false;
    }

    // Check if file is already in Queue
    if (!Queue.existsFile(self.getLocalPath(true) + self.name)) {
      // Add to Download Queue
      queueItem = Queue.addFile({
        direction: "download",
        remotePath: self.getPath(true) + self.name,
        localPath: self.getLocalPath(true) + self.name,
        size: self.size
      });
    } else {
      return false;
    }

    // Add sync icon
    self.addSyncFileIcon();

    // Create local Directories
    createLocalPath(self.getLocalPath(true) + self.name);

    // Download file
    self.getRoot()
      .connector.downloadFile(queueItem)
      .then(() => {
        // Remove sync icon
        self.removeSyncFileIcon();

        // Open file in texteditor
        return atom.workspace.open(self.getLocalPath(true) + self.name, { pending: pending, searchAllPanes: true })
          .then((editor) => {
            if (self.editor === null || self.editor === undefined) {
              self.editor = editor;
              editor.saveObject = self;

              // Save file on remote server
              try {
                editor.onDidSave((saveObject) => {
                  if (!editor.saveObject) return;

                  // Get filesize
                  FileSystem.stat(editor.getPath(true), function (err, stats) {
                    if (stats) {
                      editor.saveObject.size = stats.size;
                      editor.saveObject.attr('data-size', stats.size);
                    }
                  });

                  let parentPath = ('/' + trailingslashit(editor.saveObject.getPath(false) + editor.saveObject.name)).replace(/\/+/g, "/");

                  foundInTreeView = self.getRoot().find(parentPath);
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
                  editor.saveObject.getRoot()
                    .connector.uploadFile(queueItem)
                    .then(() => {
                      if (atom.config.get('ftp-remote-edit.notifications.showNotificationOnUpload')) {
                        editor.saveObject.getRoot()
                          .connector.showMessage('File successfully uploaded.', 'success');
                      }

                      if (foundInTreeView) {
                        // Remove sync icon
                        foundInTreeView.removeSyncFileIcon();
                      }
                    })
                    .catch(function (err) {
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
                  self.editor = null;
                });
              } catch (err) {}
            }
          })
          .catch(function (err) {
            self.getRoot().connector.showMessage(err.message, 'error');

            // Remove sync icon
            self.removeSyncFileIcon();
          });
      })
      .catch(function (err) {
        queueItem.changeStatus('Error');
        self.getRoot().connector.showMessage(err, 'error');

        // Remove sync icon
        self.removeSyncFileIcon();
      });
  }

  renameFile(relativePath) {
    const self = this;
    let fullRelativePath = ('/' + self.config.remote + '/' + relativePath)
      .replace(/\/+/g, "/");

    let fullLocalPath = (self.getRoot()
        .getLocalPath(true) + relativePath.replace(/^\//, "")
        .replace(/\/+/g, Path.sep))
      .replace(/\/+/g, Path.sep);

    self.getRoot()
      .connector.rename(self.getPath(true) + self.name, fullRelativePath.trim())
      .then(() => {
        // Refresh cache
        self.getRoot().getFinderItemsCache().renameFile(self.getPath(false) + self.name, relativePath, self.size);

        // get info from old object
        let oldObject = self;
        let fileinfo = {
          size: 0,
          rights: null
        };
        if (oldObject) {
          fileinfo.size = oldObject.size;
          fileinfo.rights = oldObject.rights;
        }

        // Add new object
        let parentPath = ('/' + trailingslashit(dirname(relativePath)))
          .replace(/\/+/g, "/");
        let parentObject = null;
        if (parentPath == '/') {
          parentObject = self.getRoot();
        } else {
          parentObject = self.getRoot()
            .find(parentPath);
          if (parentObject) {
            parentObject = parentObject.view();
          }
        }

        // Check if file is already opened in texteditor
        let found = null;
        found = self.getTextEditor(oldObject.getLocalPath(true) + oldObject.name);

        if (parentObject) {
          let elementname = basename(relativePath);
          let pathOnFileSystem = parentObject.getPath() + elementname;
          pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");
          let newObject = new FileView(parentObject, {
            name: elementname,
            path: pathOnFileSystem,
            size: fileinfo.size,
            rights: fileinfo.rights
          });
          parentObject.entries.append(newObject);
          if (parentObject.isExpanded) {
            parentObject.refresh(parentObject)
            parentObject.deselect();
            parentObject.select(newObject);
          }

          if (found) {
            found.saveObject = newObject;
            found.saveAs(newObject.getLocalPath(true) + newObject.name);
          }
        } else {
          let newObject = self.getElementByLocalPath(fullLocalPath);

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
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  moveFile(initialPath, newDirectoryPath) {
    const self = this;

    self.parent.moveFile(initialPath, newDirectoryPath);
  }

  copyFile(initialPath, newDirectoryPath) {
    const self = this;
    self.parent.copyFile(initialPath, newDirectoryPath);
  }

  deleteFile() {
    const self = this;
    self.getRoot()
      .connector.deleteFile(self.getPath(true) + self.name)
      .then(() => {
        // Refresh cache
        self.getRoot().getFinderItemsCache().deleteFile(self.getPath(false) + self.name);

        let fullLocalPath = (self.getLocalPath(true) + self.name.replace(/^\//, "").replace(/\/+/g, Path.sep)).replace(/\/+/g, Path.sep);

        // Delete local file
        try {
          if (FileSystem.existsSync(fullLocalPath)) {
            FileSystem.unlinkSync(fullLocalPath);
          }
        } catch (err) {}

        self.destroy();
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  chmodFile(permissions) {
    const self = this;

    self.getRoot().connector.chmodFile(self.getPath(true) + self.name, permissions).then((responseText) => {
      self.rights = permissionsToRights(permissions);
    }).catch(function (err) {
      self.getRoot().connector.showMessage(err.message, 'error');
    });
  }

  onDragStart(e) {
    const self = this;
    let entry, initialPath;

    if (entry = e.target.closest('.entry')) {
      e.stopPropagation();
      initialPath = self.getPath(false) + self.name;

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("initialPath", initialPath);
        e.dataTransfer.setData("initialType", "file");
        e.dataTransfer.setData("initialName", self.name);
      } else if (e.originalEvent.dataTransfer) {
        e.originalEvent.dataTransfer.effectAllowed = "move";
        e.originalEvent.dataTransfer.setData("initialPath", initialPath);
        e.originalEvent.dataTransfer.setData("initialType", "file");
        e.originalEvent.dataTransfer.setData("initialName", self.name);
      }
    }
  };
}

module.exports = FileView;
