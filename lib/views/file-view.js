'use babel';

import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';
import { basename, dirname } from './../helper/format.js';

const md5 = require('md5');
const Path = require('path');
const FileSystem = require('fs-plus');
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
  }

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
    self.on('click', (e) => {
      e.stopPropagation();
      if (atom.config.get('ftp-remote-edit.tree.allowPendingPaneItems')) {
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:open-file-pending');
      }
    });
    self.on('dblclick', (e) => {
      e.stopPropagation();
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:open-file');
    });

    // Drag & Drop
    self.on('dragstart', (e) => self.onDragStart(e));
    self.on('dragenter', (e) => self.onDragEnter(e));
    self.on('dragleave', (e) => self.onDragLeave(e));
  }

  destroy() {
    this.remove();
  }

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

    return self.parent.getLocalPath(useRemote).replace(/\/+/g, Path.sep);
  }

  getElementByLocalPath(pathOnFileSystem) {
    const self = this;

    let elementname = basename(pathOnFileSystem, Path.sep);
    let elementpath = dirname(pathOnFileSystem, Path.sep) + elementname;
    let dirpath = dirname(pathOnFileSystem, Path.sep);

    let elementparent = self.getRoot().treeView.getElementByLocalPath(dirpath, self.getRoot());
    if (!elementparent) return null;

    // Get filesize
    let element;
    let stats = FileSystem.statSync(elementpath);
    if (stats) {
      element = new FileView(elementparent, {
        name: elementname,
        path: elementpath,
        size: stats.size,
        rights: null
      });
    } else {
      element = new FileView(elementparent, {
        name: elementname,
        path: elementpath,
        size: 0,
        rights: null
      });
    }

    return element;
  }

  addSyncFileIcon(element = null) {
    const self = this;

    if (!element) element = self;
    if (!element.label) return;

    element.label.addClass('icon-sync').addClass('spin');
  }

  removeSyncFileIcon(element = null) {
    const self = this;

    if (!element) element = self;
    if (!element.label) return;

    element.label.removeClass('icon-sync').removeClass('spin');
  }

  onDragStart(e) {
    const self = this;

    let initialPath;

    if (entry = e.target.closest('.entry')) {
      console.log('start',entry);
      
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
  }

  onDragEnter(e) {
    const self = this;

    let entry, initialType;

    if (entry = e.target.closest('.entry')) {
      console.log('f enter',entry);
      e.stopPropagation();

      if (e.dataTransfer) {
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }

      if (initialType == "server") {
        return;
      }
      directory = entry.parentNode.parentNode;
      if (!directory.classList.contains('selected')) {
        directory.classList.add('selected');
      }
    }
  }

  onDragLeave(e) {
    const self = this;

    let entry, directory, initialType;

    if (entry = e.target.closest('.entry')) {
      console.log('f leave',entry);
      e.stopPropagation();

      if (e.dataTransfer) {
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }

      if (initialType == "server") {
        return;
      }

      // if (!entry.classList.contains('selected')) {
      //   entry.classList.remove('selected');
      // }
    }
  }
}

module.exports = FileView;
