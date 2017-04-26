'use babel';

import Ftp from './../connectors/ftp.js';
// import Sftp from './../connectors/sftp.js';
import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';

var FileSystem = require('fs');
const tempDirectory = require('os').tmpdir();

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

    self.connector = null;
    if (self.config.sftp === true) {
      self.connector = new Sftp(self.config);
    } else {
      self.connector = new Ftp(self.config);
    }

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

  getPath() {
    const self = this;

    return self.parent.getPath();
  }

  getLocalPath() {
    const self = this;

    return self.parent.getLocalPath();
  }

  open() {
    const self = this;

    self.label.addClass('icon-sync')
      .removeClass('icon-file-text');

    self.connector.isFileOnServer(self.getPath() + '/' + self.name)
      .then((file) => {
        if (file !== undefined && file !== null) {

          // Create local Directories
          this.checkPath(self.getLocalPath() + '/' + self.name);

          // Download file and open
          self.connector.writeTextToFile(self.getPath() + '/' + self.name, self.getLocalPath() + '/' + self.name)
            .then(() => {
              self.label.removeClass('icon-sync')
                .addClass('icon-file-text');
              return atom.workspace.open(self.getLocalPath() + '/' + self.name);
            })
            .catch(function (err) {
              self.label.removeClass('icon-sync')
                .addClass('icon-file-text');
            })
            .then((editor) => {
              if (this.editor === null || this.editor === undefined) {
                this.editor = editor;

                // Save file on remote server
                editor.onDidSave((saveObject) => {
                  self.connector.saveFileToServer(editor.getText(), self.getPath() + '/' + self.name, editor.getPath());
                });

                editor.onDidDestroy(() => {
                  this.editor = null;
                });
              }
            });
        }
      })
      .catch(function (err) {
        self.label.removeClass('icon-sync')
          .addClass('icon-file-text');
      });
  }

  rename(relativePath) {
    const self = this;

    self.connector.rename(self.getPath() + '/' + self.name, relativePath.trim())
      .then(() => {
        let pathArr = relativePath.trim()
          .split('/');

        self.name = pathArr.pop();
        self.label.text(self.name);
        self.attr('data-name', self.name);
      });
  }

  delete() {
    const self = this;

    self.connector.delete(self.getPath() + '/' + self.name)
      .then(() => {
        self.destroy();
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
