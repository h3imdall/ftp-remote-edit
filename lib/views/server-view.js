'use babel';

import { $, View } from 'atom-space-pen-views';
import { showMessage, isPathIgnored } from './../helper/helper.js';
import { unleadingslashit, untrailingslashit, normalize } from './../helper/format.js';
import FinderItemsCache from './../helper/finder-items-cache.js';
import Connector from './../connectors/connector.js';
import DirectoryView from './directory-view.js';
import FileView from './file-view.js';

const shortHash = require('short-hash');
const md5 = require('md5');
const Path = require('path');
const tempDirectory = require('os').tmpdir();

class ServerView extends View {

  static content() {
    return this.li({
      class: 'server entry list-nested-item project-root collapsed',
    }, () => {
      this.div({
        class: 'header list-item project-root-header',
        outlet: 'header',
      }, () => this.span({
        class: 'name icon',
        outlet: 'label',
      }));
      this.ol({
        class: 'entries list-tree',
        outlet: 'entries',
      });
    });
  }

  serialize() {
    const self = this;

    return {
      id: self.id,
      config: self.config,
      name: self.name,
      path: self.getPath(false),
    };
  }

  initialize(config) {
    const self = this;

    self.config = config;
    self.expanded = false;
    self.finderItemsCache = null;

    self.name = self.config.name ? self.config.name : self.config.host;
    self.id = self.getId();

    self.label.text(self.name);
    self.label.addClass('icon-file-symlink-directory');
    self.addClass('project-root');

    if(typeof self.config.temp != 'undefined' && self.config.temp)
        self.addClass('temp');

    self.attr('data-name', '/');
    self.attr('data-host', self.config.host);
    self.attr('id', self.id);

    self.connector = new Connector(self.config);

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

    if (self.finderItemsCache) {
      self.finderItemsCache = null;
    }

    this.remove();
  }

  getId() {
    const self = this;

    let object = {
      config: self.config,
      name: self.name,
      path: self.getPath(false),
    };

    return 'ftp-remote-edit-' + md5(JSON.stringify(object));
  }

  getRoot() {
    const self = this;

    return self;
  }

  getPath(useRemote = true) {
    const self = this;

    if (self.config.remote && useRemote) {
      return unleadingslashit(untrailingslashit(normalize(self.config.remote)));
    } else {
      return '/';
    }
  }

  getLocalPath(useRemote = true) {
    const self = this;

    if (self.config.remote && useRemote) {
      return untrailingslashit(normalize(tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/' + self.config.remote, Path.sep), Path.sep);
    } else {
      return untrailingslashit(normalize(tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host, Path.sep), Path.sep);
    }
  }

  getConnector() {
    const self = this;

    return self.connector;
  }

  getFinderCache() {
    const self = this;

    if (self.finderItemsCache) return self.finderItemsCache;

    self.finderItemsCache = new FinderItemsCache(self.config, self.getConnector());

    return self.finderItemsCache;
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
              size: element.size,
              rights: element.rights
            });
            entries.push(li);
          }
        }, this);

        // Refresh cache
        self.getFinderCache().refreshDirectory(self.getPath(false), files);

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

    self.connector.destroy();

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

    return self.expanded;
  }

  isVisible() {
    const self = this;

    return true;
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

    if (entry = e.target.closest('.entry.server')) {
      e.stopPropagation();
      initialPath = self.getPath(true);

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("initialType", "server");
      } else if (e.originalEvent.dataTransfer) {
        e.originalEvent.dataTransfer.effectAllowed = "move";
        e.originalEvent.dataTransfer.setData("initialType", "server");
      }
    }
  }

  onDragEnter(e) {
    const self = this;

    let entry, initialType;

    if (entry = e.target.closest('.entry.server')) {
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

    if (entry = e.target.closest('.entry.server')) {
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

module.exports = ServerView;
