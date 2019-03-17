'use babel';

import { $, View } from 'atom-space-pen-views';
import { showMessage, isPathIgnored } from './../helper/helper.js';
import { unleadingslashit, untrailingslashit, normalize } from './../helper/format.js';
import FileView from './file-view.js';

const md5 = require('md5');
const Path = require('path');

class DirectoryView extends View {

  static content() {
    return this.li({
      class: 'directory entry list-nested-item collapsed',
    }, () => {
      this.div({
        class: 'header list-item',
        outlet: 'header',
        tabindex: -1,
      }, () => this.span({
        class: 'name icon',
        outlet: 'label',
      }));
      this.ol({
        class: 'entries list-tree',
        outlet: 'entries',
        tabindex: -1,
      });
    });
  }

  serialize() {
    const self = this;

    return {
      id: self.id,
      config: self.config,
      name: self.name,
      rights: self.rights,
      path: self.getPath(false),
    };
  }

  initialize(parent, directory) {
    const self = this;

    self.parent = parent;
    self.config = parent.config;
    self.expanded = false;

    self.name = directory.name;
    self.rights = directory.rights;
    self.id = self.getId();

    // Add directory name
    self.label.text(self.name);

    // Add directory icon
    self.label.addClass('icon-file-directory');

    self.attr('data-name', self.name);
    self.attr('data-host', self.config.host);
    self.attr('id', self.id);

    // Events
    self.on('click', (e) => {
      e.stopPropagation();
      self.toggle();
    });
    self.on('dblclick', (e) => { e.stopPropagation(); });

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

    return 'ftp-remote-edit-' + md5(self.getPath(false));
  }

  getRoot() {
    const self = this;

    return self.parent.getRoot();
  }

  getPath(useRemote = true) {
    const self = this;

    return untrailingslashit(normalize(self.parent.getPath(useRemote) + self.name));
  }

  getLocalPath(useRemote = true) {
    const self = this;

    return untrailingslashit(normalize(self.parent.getLocalPath(useRemote) + self.name, Path.sep), Path.sep);
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

  expand() {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      if (self.isExpanded()) return resolve(true);

      self.addSyncIcon();
      self.getConnector().listDirectory(self.getPath()).then((list) => {
        self.expanded = true;
        self.addClass('expanded').removeClass('collapsed');
        self.removeSyncIcon();

        self.entries.children().detach();

        let directories = list.filter((item) => {
          return item.type === 'd' && item.name !== '.' && item.name !== '..';
        });

        let files = list.filter((item) => {
          return item.type === '-';
        });

        directories.sort((a, b) => {
          if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
          if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
          if (a.name < b.name) return -1;
          if (a.name > b.name) return 1;
          return 0;
        });

        files.sort((a, b) => {
          if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
          if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
          if (a.name < b.name) return -1;
          if (a.name > b.name) return 1;
          return 0;
        });

        let entries = [];

        directories.forEach((element) => {
          const pathOnFileSystem = normalize(self.getPath() + element.name, Path.sep);

          if (!isPathIgnored(pathOnFileSystem)) {
            let li = new DirectoryView(self, {
              name: element.name,
              path: pathOnFileSystem,
              rights: element.rights
            });
            entries.push(li);
          }
        }, this);

        files.forEach((element) => {
          const pathOnFileSystem = normalize(self.getPath() + element.name, Path.sep);

          if (!isPathIgnored(pathOnFileSystem)) {
            let li = new FileView(self, {
              name: element.name,
              path: pathOnFileSystem,
              size: element.size,
              rights: element.rights
            });
            entries.push(li);
          }
        }, this);

        // Refresh cache
        self.getRoot().getFinderCache().refreshDirectory(self.getPath(false), files);

        if (!atom.config.get('ftp-remote-edit.tree.sortFoldersBeforeFiles')) {
          entries.sort((a, b) => {
            if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
            if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
          });
        }

        entries.forEach((entry) => {
          self.entries.append(entry);
        });

        self.select();

        resolve(true);
      }).catch((err) => {
        self.collapse();
        showMessage(err.message, 'error');
        reject(err);
      });
    });

    return promise;
  }

  collapse() {
    const self = this;

    self.expanded = false;
    self.addClass('collapsed').removeClass('expanded');
    self.removeSyncIcon();
  }

  toggle() {
    const self = this;

    if (self.isExpanded()) {
      self.collapse();
    } else {
      self.expand().catch((err) => {
        showMessage(err.message, 'error');
      })
    }
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

  isExpanded() {
    const self = this;

    return self.parent.isExpanded() && self.expanded;
  }

  isVisible() {
    const self = this;

    return self.parent.isExpanded();
  }

  refresh(elementToRefresh) {
    const self = this;

    let sortFoldersBeforeFiles = atom.config.get('ftp-remote-edit.tree.sortFoldersBeforeFiles');
    if (elementToRefresh.entries[0].childNodes) {
      let e = elementToRefresh.entries[0].childNodes;
      [].slice.call(e).sort((a, b) => {
        if (sortFoldersBeforeFiles) {
          if (a.classList.contains('directory') && b.classList.contains('file')) return -1;
          if (a.classList.contains('file') && b.classList.contains('directory')) return 1;
          if (a.spacePenView.name < b.spacePenView.name) return -1;
          if (a.spacePenView.name > b.spacePenView.name) return 1;
        } else {
          if (a.spacePenView.name < b.spacePenView.name) return -1;
          if (a.spacePenView.name > b.spacePenView.name) return 1;
        }
        return 0;
      }).forEach((val, index) => {
        self.entries.append(val);
      });
    }
  }

  onDragStart(e) {
    const self = this;

    let initialPath;

    if (entry = e.target.closest('.entry.directory')) {
      e.stopPropagation();
      initialPath = self.getPath(false);

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("initialPath", initialPath);
        e.dataTransfer.setData("initialType", "directory");
        e.dataTransfer.setData("initialName", self.name);
      } else if (e.originalEvent.dataTransfer) {
        e.originalEvent.dataTransfer.effectAllowed = "move";
        e.originalEvent.dataTransfer.setData("initialPath", initialPath);
        e.originalEvent.dataTransfer.setData("initialType", "directory");
        e.originalEvent.dataTransfer.setData("initialName", self.name);
      }
    }
  }

  onDragEnter(e) {
    const self = this;

    let entry, initialType;

    if (entry = e.target.closest('.entry.directory')) {
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

    if (entry = e.target.closest('.entry.directory')) {
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

module.exports = DirectoryView;
