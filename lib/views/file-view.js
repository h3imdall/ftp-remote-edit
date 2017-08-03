'use babel';

import Connector from './../connectors/connector.js';
import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';

const Path = require('path')
const FileSystem = require('fs');

class FileView extends View {

  FileView() {
    super.FileView();

    const self = this;

    self.parent = null;
    self.config = null;
    self.name = '';
  }

  static content() {
    return this.li({
      class: 'file entry list-item',
    }, () => this.span({
      class: 'name icon',
      outlet: 'label',
    }));
  };

  initialize(parent, file) {
    const self = this;

    self.parent = parent;
    self.config = parent.config;
    self.name = file.name;

    self.label.text(self.name);
    self.label.addClass('icon-file-text');

    self.attr('data-name', self.name);
    self.attr('data-host', self.config.host);

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

    self.getRoot()
      .connector.existsFile(self.getPath(true) + self.name)
      .then((file) => {
        if (file !== undefined && file !== null) {

          // Create local Directories
          self.checkPath(self.getLocalPath(true) + self.name);

          // Download file and open
          self.getRoot()
            .connector.downloadFile(self.getPath(true) + self.name, self.getLocalPath(true) + self.name)
            .then(() => {
              self.label.removeClass('icon-sync')
                .removeClass('spin')
                .addClass('icon-file-text');
              return atom.workspace.open(self.getLocalPath(true) + self.name);
            })
            .catch(function (err) {
              self.label.removeClass('icon-sync')
                .removeClass('spin')
                .addClass('icon-file-text');
            })
            .then((editor) => {
              if (self.editor === null || self.editor === undefined) {
                self.editor = editor;

                // Save file on remote server
                try {
                  editor.onDidSave((saveObject) => {
                    self.getRoot()
                      .connector.uploadFile(editor.getText(), self.getPath(true) + self.name, editor.getPath(true))
                      .then(() => {
                        self.getRoot()
                          .connector.showMessage('File successfully uploaded.', 'success');
                      })
                      .catch(function (err) {
                        self.getRoot()
                          .connector.showMessage(err.message, 'error');
                      });
                  });
                } catch (err) {}

                editor.onDidDestroy(() => {
                  self.editor = null;
                });
              }
            });
        }
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
        self.label.removeClass('icon-sync')
          .removeClass('spin')
          .addClass('icon-file-text');
      });
  }

  rename(relativePath) {
    const self = this;
    let fullRelativePath = ('/' + self.config.remote + '/' + relativePath)
      .replace(/\/+/g, "/");

    self.getRoot()
      .connector.rename(self.getPath(true) + self.name, fullRelativePath.trim())
      .then(() => {
        let pathArr = relativePath.trim()
          .split('/');

        self.name = pathArr.pop();
        self.label.text(self.name);
        self.attr('data-name', self.name);
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
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
      initialPath = self.getPath(true) + self.name;

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("initialPath", initialPath);
        e.dataTransfer.setData("initialType", "file");
      } else if (e.originalEvent.dataTransfer) {
        e.originalEvent.dataTransfer.effectAllowed = "move";
        e.originalEvent.dataTransfer.setData("initialPath", initialPath);
        e.originalEvent.dataTransfer.setData("initialType", "file");
      }
    }
  };
}

module.exports = FileView;
