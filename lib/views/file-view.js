'use babel';

import Connector from './../connectors/connector.js';
import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';

var FileSystem = require('fs');
const tempDirectory = require('os')
  .tmpdir();

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

    return self.parent.getLocalPath(useRemote);
  }

  open() {
    const self = this;

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
    let arrPath = localpath.split('/');
    arrPath.pop();

    arrPath.reduce((path, dir) => {
      path += '/' + dir;
      if (!FileSystem.existsSync(path)) {
        FileSystem.mkdirSync(path);
      }
      return path;
    });

  }
}

module.exports = FileView;
