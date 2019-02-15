'use babel';

import { $, View } from 'atom-space-pen-views';
import { normalize } from './../helper/format.js';

const md5 = require('md5');
const Path = require('path');
const getIconServices = require('./../helper/icon.js');

class FileView extends View {

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
    const self = this;

    self.remove();
  }

  getId() {
    const self = this;

    return 'ftp-remote-edit-' + md5(self.getPath(false) + self.name);
  }

  getRoot() {
    const self = this;

    return self.parent.getRoot();
  }

  getPath(useRemote = true) {
    const self = this;

    return normalize(self.parent.getPath(useRemote));
  }

  getLocalPath(useRemote = true) {
    const self = this;

    return normalize(self.parent.getLocalPath(useRemote), Path.sep);
  }

  getConnector() {
    const self = this;

    return self.getRoot().getConnector();
  }

  addSyncIcon(element = null) {
    const self = this;

    if (!element) element = self;
    if (!element.label) return;

    element.label.addClass('icon-sync').addClass('spin');
  }

  removeSyncIcon(element = null) {
    const self = this;

    if (!element) element = self;
    if (!element.label) return;

    element.label.removeClass('icon-sync').removeClass('spin');
  }

  select(deselectAllOther = true) {
    const self = this;

    if (deselectAllOther) {
      elementsToDeselect = $('.ftp-remote-edit-view .selected');
      for (i = 0, len = elementsToDeselect.length; i < len; i++) {
        selected = elementsToDeselect[i];
        $(selected).removeClass('selected');
      }
    }

    if (!self.hasClass('selected')) {
      self.addClass('selected');
    }
  }

  deselect() {
    const self = this;

    if (self.hasClass('selected')) {
      self.removeClass('selected');
    }
  }

  isVisible() {
    const self = this;

    return self.parent.isExpanded();
  }

  onDragStart(e) {
    const self = this;

    let initialPath;

    if (entry = e.target.closest('.entry.file')) {
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

    if (entry = e.target.closest('.entry.file')) {
      e.stopPropagation();

      if (e.dataTransfer) {
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }

      if (initialType == "server") {
        return;
      }

      $(entry).view().select();
    }
  }

  onDragLeave(e) {
    const self = this;

    let entry, initialType;

    if (entry = e.target.closest('.entry.file')) {
      e.stopPropagation();

      if (e.dataTransfer) {
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }

      if (initialType == "server") {
        return;
      }

      $(entry).view().deselect();
    }
  }
}

module.exports = FileView;
