'use babel';

import Connector from './../connectors/connector.js';
import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';
import { basename, dirname, trailingslashit } from './../helper/format.js';
import DirectoryView from './directory-view.js';
import ServerView from './server-view.js';

const md5 = require('md5');
const Path = require('path');
const FileSystem = require('fs-plus');
const Queue = require('./../helper/queue.js');

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

    self.label.text(self.name);
    self.label.addClass('icon-file-text');

    self.attr('data-name', self.name);
    self.attr('data-host', self.config.host);
    self.attr('data-size', self.size);
    self.attr('id', self.id);

    // Events
    self.on('click', function (e) {
      e.stopPropagation();
      self.open();
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();
    });

    // Drag & Drop
    self.on('dragstart', (e) => self.onDragStart(e));
  };

  destroy() {
    this.remove();
  };

  getId() {
    const self = this;

    let object = {
      config: self.config,
      name: self.name,
      size: self.size,
      rights: self.rights,
      path: self.getPath(false),
    };

    return 'ftp-remote-edit-' + md5(JSON.stringify(object));
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
        elementsize = stats.size;
      }
    });

    let element = new FileView(elementparent, {
      name: elementname,
      path: elementpath,
      size: elementsize,
      rights: null
    });

    return element;
  }

  open() {
    const self = this;

    // Check if file is already opened
    let found = null;
    texteditors = atom.workspace.getTextEditors();
    texteditors.forEach((texteditor) => {
      if (texteditor.getPath() == self.getLocalPath(true) + self.name) {
        found = texteditor;
        return false;
      }
    });
    if (found) {
      pane = atom.workspace.paneForItem(found);
      if (pane) pane.activateItem(found);
      return false;
    }

    self.label.addClass('icon-sync')
      .addClass('spin')
      .removeClass('icon-file-text');

    // Add to Download Queue
    let queueItem = Queue.addFile({
      direction: "download",
      remotePath: self.getPath(true) + self.name,
      localPath: self.getLocalPath(true) + self.name,
      size: self.size
    });

    // Create local Directories
    self.checkPath(self.getLocalPath(true) + self.name);

    // Download file and open
    self.getRoot()
      .connector.downloadFile(queueItem)
      .then(() => {
        self.label.removeClass('icon-sync')
          .removeClass('spin')
          .addClass('icon-file-text');

        return atom.workspace.open(self.getLocalPath(true) + self.name)
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

                  let parentPath = ('/' + trailingslashit(editor.saveObject.getPath(false) + editor.saveObject.name))
                    .replace(/\/+/g, "/");
                  found = self.getRoot()
                    .find(parentPath);
                  if (found) {
                    found = found.view();
                    found.label.addClass('icon-sync')
                      .addClass('spin')
                      .removeClass('icon-file-text');
                  }

                  // Add to Upload Queue
                  let queueItem = Queue.addFile({
                    direction: "upload",
                    remotePath: editor.saveObject.getPath(true) + editor.saveObject.name,
                    localPath: editor.saveObject.getLocalPath(true) + editor.saveObject.name,
                    size: editor.saveObject.size
                  });

                  editor.saveObject.getRoot()
                    .connector.uploadFile(editor.getText(), queueItem)
                    .then(() => {
                      if (atom.config.get('ftp-remote-edit.notifications.ShowNotificationOnUpload')) {
                        editor.saveObject.getRoot()
                          .connector.showMessage('File successfully uploaded.', 'success');
                      }

                      if (found) {
                        found.label.removeClass('icon-sync')
                          .removeClass('spin')
                          .addClass('icon-file-text');
                      }
                    })
                    .catch(function (err) {
                      queueItem.changeStatus('Error');
                      editor.saveObject.getRoot()
                        .connector.showMessage(err.message, 'error');

                      if (found) {
                        found.label.removeClass('icon-sync')
                          .removeClass('spin')
                          .addClass('icon-file-text');
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
            self.getRoot()
              .connector.showMessage(err.message, 'error');
            self.label.removeClass('icon-sync')
              .removeClass('spin')
              .addClass('icon-file-text');
          });
      })
      .catch(function (err) {
        queueItem.changeStatus('Error');
        self.label.removeClass('icon-sync')
          .removeClass('spin')
          .addClass('icon-file-text');
      });
  }

  rename(relativePath) {
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

        // Check if file is already opened
        let found = null;
        texteditors = atom.workspace.getTextEditors();
        texteditors.forEach((texteditor) => {
          if (texteditor.getPath() == oldObject.getLocalPath(true) + oldObject.name) {
            found = texteditor;
            return false;
          }
        });

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

  moveDirectory(initialPath, newDirectoryPath) {
    const self = this;

    self.parent.moveDirectory(initialPath, newDirectoryPath);
  }

  moveFile(initialPath, newDirectoryPath) {
    const self = this;

    self.parent.moveFile(initialPath, newDirectoryPath);
  }

  delete() {
    const self = this;

    self.getRoot()
      .connector.deleteFile(self.getPath(true) + self.name)
      .then(() => {
        self.destroy();
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  checkPath(localpath) {
    let arrPath = localpath.split(Path.sep);
    arrPath.pop();

    arrPath.reduce((tmpPath, dir) => {
      tmpPath += Path.sep + dir;
      if (!FileSystem.existsSync(tmpPath)) {
        FileSystem.mkdirSync(tmpPath);
      }
      return tmpPath;
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
