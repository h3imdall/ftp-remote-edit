'use babel';

import Ftp from './../connectors/ftp.js';
//import Sftp from './../connectors/sftp.js';
import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';

var FileSystem = require('fs');
const tempDirectory = require('os').tmpdir();

class FileView extends View {
  FileView() {
    super.FileView();

    const self = this;
    self.config = null;
    self.name = '';
    self.path = '';
    self.localpath = '';
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

    self.config = parent.config;
    self.name = file.name;
    self.path = file.path;
    self.localpath = tempDirectory + '/' + self.config.host + '/' + self.path;

    self.label.text(self.name);
    self.label.addClass('icon-file-text');

    self.attr('data-host', self.config.host);
    self.attr('data-path', self.path);

    self.connector = null;
    if (self.config.sftp === true) {
      self.connector = new Sftp(self.config);
    } else {
      self.connector = new Ftp(self.config);
    }

    // Events
    self.on('click', function (e) {
      e.stopPropagation();

      self.deselect();
      self.toggleClass('selected');
      self.open();
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();
    });
  };

  open() {
    const self = this;

    self.label.addClass('icon-sync').removeClass('icon-file-text');
    self.connector.isFileOnServer(self.path)
      .then((file) => {
        if (file !== undefined && file !== null) {

          // Create local Directories
          this.checkPath(self.localpath);

          // Download file and open
          self.connector.writeTextToFile(self.path, self.localpath)
            .then(() => {
              self.label.removeClass('icon-sync').addClass('icon-file-text');
              return atom.workspace.open(self.localpath);
            })

            .then((editor) => {
              if (this.editor === null || this.editor === undefined) {
                this.editor = editor;

                // Save file on remote server
                editor.onDidSave((saveObject) => {
                  self.connector.saveFileToServer(editor.getText(), self.path, editor.getPath());
                });

                editor.onDidDestroy(() => {
                  this.editor = null;
                });
              }
            });
        }
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

  getSelectedEntries() {
    return $('.ftp-remote-edit-view .selected');
  };

  deselect(elementsToDeselect) {
    var i, len, selected;
    if (elementsToDeselect == null) {
      elementsToDeselect = this.getSelectedEntries();
    }
    for (i = 0, len = elementsToDeselect.length; i < len; i++) {
      selected = elementsToDeselect[i];
      selected.classList.remove('selected');
    }
    return void 0;
  };
}

module.exports = FileView;
