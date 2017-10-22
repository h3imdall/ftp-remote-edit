'use babel';

import Connector from './../connectors/connector.js';
import DirectoryView from './directory-view.js';
import FinderItemsCache from './../helper/finder-items-cache.js';

const md5 = require('md5');

class ServerView extends DirectoryView {

  ServerView() {
    super.ServerView();

    const self = this;

    self.id = null;
    self.parent = null;
    self.config = null;
    self.name = '';
    self.isExpanded = false;
    self.debug = false;
    self.finderItemsCache = null;
  }

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
  };

  serialize() {
    const self = this;

    return {
      id: self.id,
      config: self.config,
      name: self.name,
      path: self.getPath(false),
    };
  }

  initialize(config, treeView) {
    const self = this;

    self.treeView = treeView
    self.parent = null;
    self.config = config;
    self.name = self.config.name ? self.config.name : self.config.host;
    self.isExpanded = false;
    self.id = self.getId();

    if (atom.config.get('ftp-remote-edit.dev.debug')) {
      self.debug = atom.config.get('ftp-remote-edit.dev.debug');
    } else {
      self.debug = false;
    }

    self.label.text(self.name);
    self.label.addClass('icon-file-symlink-directory');
    self.addClass('project-root');

    self.attr('data-name', '/');
    self.attr('data-host', self.config.host);
    self.attr('id', self.id);

    self.connector = null;
    self.connector = new Connector(self.config);

    // Events
    self.connector.on('log', function (msg) {
      self.treeView.ftpLogView.trigger('log', msg);
    });
    self.connector.on('debug', function (cmd, param1, param2) {
      if (self.debug) {
        if (param1 && param2) {
          console.log(cmd, param1, param2);
        } else if (param1) {
          console.log(cmd, param1);
        } else if (cmd) console.log(cmd);
      }
    });
    self.on('click', function (e) {
      e.stopPropagation();
      self.toggle();
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();
      self.toggle();
    });

    // Drag & Drop
    self.on('dragstart', (e) => self.onDragStart(e));
    self.on('dragenter', (e) => self.onDragEnter(e));
    self.on('dragleave', (e) => self.onDragLeave(e));
    self.on('drop', (e) => self.onDrop(e));
  };

  getId() {
    const self = this;

    let object = {
      config: self.config,
      name: self.name,
      path: self.getPath(false),
    };

    return 'ftp-remote-edit-' + md5(JSON.stringify(object));
  }

  collapse() {
    const self = this;

    self.connector.destroy();
    self.isExpanded = false;
    self.setClasses();
    self.entries.children()
      .detach();
    self.label.removeClass('icon-sync')
      .removeClass('spin')
      .addClass('icon-file-directory');
  };

  getFinderItemsCache() {
    const self = this;

    if (self.finderItemsCache) return self.finderItemsCache;

    self.finderItemsCache = new FinderItemsCache(self.config, self.connector);

    return self.finderItemsCache;
  }

  onDragStart(e) {
    const self = this;
    let entry, initialPath;

    if (entry = e.target.closest('.entry')) {
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
  };

  onDragEnter(e) {
    const self = this;
    let entry, header, initialType;

    if (header = e.target.closest('.entry.server > .header')) {
      e.stopPropagation();

      if (e.dataTransfer) {
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }
      if (initialType == "server") {
        return;
      }

      entry = header.parentNode;
      if (!entry.classList.contains('selected')) {
        entry.classList.add('selected');
      }
    }
  };

  onDragLeave(e) {
    const self = this;
    let entry, header, initialType;

    if (header = e.target.closest('.entry.server > .header')) {
      e.stopPropagation();

      if (e.dataTransfer) {
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }

      if (initialType == "server") {
        return;
      }

      entry = header.parentNode;
      if (entry.classList.contains('selected')) {
        entry.classList.remove('selected');
      }
    }
  };

  onDrop(e) {
    const self = this;
    let entry, file, i, initialPath, len, newDirectoryPath, ref;

    if (entry = e.target.closest('.entry')) {
      e.preventDefault();
      e.stopPropagation();

      entry.classList.remove('selected');
      if (!entry.classList.contains('server')) {
        return;
      }

      newDirectoryPath = self.getPath(false);
      if (!newDirectoryPath) {
        return false;
      }

      if (e.dataTransfer) {
        initialPath = e.dataTransfer.getData("initialPath");
        initialName = e.dataTransfer.getData("initialName");
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialPath = e.originalEvent.dataTransfer.getData("initialPath");
        initialName = e.originalEvent.dataTransfer.getData("initialName");
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }

      if (initialPath.trim() == newDirectoryPath.trim()) return;

      if (initialPath) {
        if (initialType == "directory") {
          newDirectoryPath += initialName + '/';
          self.moveDirectory(initialPath, newDirectoryPath);
        } else if (initialType == "file") {
          newDirectoryPath += initialName;
          self.moveFile(initialPath, newDirectoryPath);
        }
      } else {
        // Drop event from OS
        if (e.dataTransfer) {
          ref = e.dataTransfer.files;
        } else {
          ref = e.originalEvent.dataTransfer.files;
        }

        for (i = 0, len = ref.length; i < len; i++) {
          file = ref[i];
          self.upload(file.path, newDirectoryPath);
        }
      }
    }
  };
}

module.exports = ServerView;
