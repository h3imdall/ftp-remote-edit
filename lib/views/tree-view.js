'use babel';

import ServerView from './server-view.js';
import DirectoryView from './directory-view.js';
import FileView from './file-view.js';
import FtpLogView from './ftp-log-view.js';
import { $, ScrollView } from 'atom-space-pen-views';
import { basename, dirname, trailingslashit, cleanJsonString } from './../helper/format.js';
import { decrypt, encrypt, checkPassword, setPassword, b64EncodeUnicode, b64DecodeUnicode } from './../helper/secure.js';
import { resetIgnoredPatterns, resetIgnoredFinderPatterns } from './../helper/helper.js';
import { throwErrorIssue44 } from './../helper/issue.js';

const Path = require('path');
const resizeCursor = process.platform === 'win32' ? 'ew-resize' : 'col-resize';
const FTP_REMOTE_EDIT_URI = 'h3imdall://ftp-remote-edit';

class TreeView extends ScrollView {

  TreeView() {
    super.TreeView();

    const self = this;
    self.servers = null;
  };

  static content() {
    return this.div({
      class: 'ftp-remote-edit-view ftp-remote-edit-resizer tool-panel',
      'data-show-on-right-side': atom.config.get('ftp-remote-edit.tree.showOnRightSide'),
    }, () => {
      this.div({
        class: 'ftp-remote-edit-scroller order--center',
        outlet: 'scroller',
      }, () => {
        this.ol({
          class: 'ftp-remote-edit-list full-menu list-tree has-collapsable-children focusable-panel',
          tabindex: -1,
          outlet: 'list',
        });
      });

      this.div({
        class: 'ftp-remote-edit-resize-handle',
        outlet: 'horizontalResize',
      });

      this.subview('ftpLogView', new FtpLogView());

      this.div({
        class: 'info',
        tabindex: -1,
        outlet: 'info',
      });
    });
  };

  getTitle() {
    return "Ftp-Remote-Edit";
  }

  getURI() {
    return FTP_REMOTE_EDIT_URI;
  }

  getAllowedLocations() {
    return ["left", "right"];
  }

  getDefaultLocation() {
    if (atom.config.get('ftp-remote-edit.tree.showOnRightSide')) {
      return "right";
    } else {
      return "left";
    }
  }

  isPermanentDockItem() {
    return true;
  }

  initialize(state) {
    super.initialize(state)

    const self = this;

    let html = '<background-tip>';
    html += '<ul class="centered background-message">';
    html += '<li class="message fade-in">You can edit the servers from the Settings View with ftp-remote-edit:edit-servers<br/><br/><a role="configure" class="btn btn-xs btn-default icon">Edit Servers</a></li>';
    html += '</ul>';
    html += '</background-tip>';
    self.info.html(html);

    if (!self.servers) {
      self.showInfo();
    } else {
      self.hideInfo();
    }

    // Events
    atom.config.onDidChange('ftp-remote-edit.tree.showOnRightSide', () => {
      self.element.dataset.showOnRightSide = atom.config.get('ftp-remote-edit.tree.showOnRightSide');
      if (self.isVisible() && atom.config.get('ftp-remote-edit.tree.showInDock') == false) {
        self.detach();
        self.attach();
      }
    });
    atom.config.onDidChange('ftp-remote-edit.tree.sortFoldersBeforeFiles', () => {
      if (self.isVisible()) {
        self.reload();
      }
    });
    atom.config.onDidChange('ftp-remote-edit.tree.sortServerProfilesByName', () => {
      if (self.isVisible()) {
        self.reload();
      }
    });
    atom.config.onDidChange('ftp-remote-edit.tree.hideIgnoredNames', () => {
      resetIgnoredPatterns();
      if (self.isVisible()) {
        self.reload();
      }
    });
    atom.config.onDidChange('core.ignoredNames', () => {
      resetIgnoredPatterns();
      resetIgnoredFinderPatterns();
      if (self.isVisible()) {
        self.reload();
      }
    });
    atom.config.onDidChange('ftp-remote-edit.finder.ignoredNames', () => {
      resetIgnoredPatterns();
      resetIgnoredFinderPatterns();
      if (self.isVisible()) {
        self.reload();
      }
    });

    self.on('mousedown', (e) => {
      var entryToSelect;
      if (entryToSelect = e.target.closest('.entry')) {
        e.stopPropagation();
        this.selectEntry(entryToSelect);
      }
    });

    // Info Panel
    self.info.on('click', '[role="configure"]', (e) => {
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:edit-servers');
    });
    self.info.on('click', '[role="toggle"]', (e) => {
      self.toggle();
    });

    // Resize Panel
    self.horizontalResize.on('dblclick', (e) => {
      self.resizeToFitContent(e);
    });
    self.horizontalResize.on('mousedown', (e) => {
      self.resizeHorizontalStarted(e);
    });

    // Keyboard Navigation
    self.list.on('keydown', (e) => { self.remoteKeyboardNavigation(e); });
  };

  attach() {
    const self = this;

    if (atom.config.get('ftp-remote-edit.tree.showOnRightSide')) {
      self.panel = atom.workspace.addRightPanel({
        item: self
      });
    } else {
      self.panel = atom.workspace.addLeftPanel({
        item: self
      });
    }
  };

  detach() {
    const self = this;

    if (self.panel) {
      self.panel.destroy();
      self.panel = null;
    }
  };

  destroy() {
    const self = this;

    if (self.list) {
      if (self.list.children()) {
        self.list.children()
          .detach();
      }
      self.servers = null;
    }
    self.remove();
  };

  toggle() {
    const self = this;

    if (atom.config.get('ftp-remote-edit.tree.showInDock')) {
      atom.workspace.toggle(this);
    } else {
      if (self.isVisible()) {
        self.detach();
      } else {
        self.attach();
        self.resizeToFitContent();
      }
    }
  };

  loadServers(password) {
    const self = this;

    // Add detail information in error notification
    // Uncaught SyntaxError: Unexpected token  in JSON at position 0 #44
    // https://github.com/h3imdall/ftp-remote-edit/issues/44
    let configHash = atom.config.get('ftp-remote-edit.config');
    if (configHash) {
      let config = decrypt(password, configHash);
      let sortServerProfilesByName = atom.config.get('ftp-remote-edit.tree.sortServerProfilesByName');

      try {
        self.servers = JSON.parse(cleanJsonString(config));
        self.servers.sort((a, b) => {
          if (sortServerProfilesByName) {
            if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
            if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
          } else {
            if (a.host < b.host) return -1;
            if (a.host > b.host) return 1;
          }
          return 0;
        });
        return true;

      } catch (e) {
        throwErrorIssue44(e, password);
        return false;
      }
    }
    return true;
  }

  reload() {
    const self = this;

    if (!self.servers) {
      self.list.children().detach();
      self.showInfo();
      return;
    }

    self.list.children().detach();
    self.hideInfo();

    let sortServerProfilesByName = atom.config.get('ftp-remote-edit.tree.sortServerProfilesByName');
    self.servers.sort((a, b) => {
      if (sortServerProfilesByName) {
        if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
        if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
      } else {
        if (a.host < b.host) return -1;
        if (a.host > b.host) return 1;
      }
      return 0;
    });

    self.servers.forEach((config) => {
      self.addServer(config);
    });
  };

  addServer(config) {
    const self = this;
    
    let server = new ServerView(config, self);
    self.list.append(server);
  };

  showInfo() {
    this.info.css('display', 'flex');
  };

  hideInfo() {
    this.info.hide();
  };

  deselect(elementsToDeselect) {
    let i, len, selected;
    if (elementsToDeselect == null) {
      elementsToDeselect = $('.ftp-remote-edit-view .selected');
    }
    for (i = 0, len = elementsToDeselect.length; i < len; i++) {
      selected = elementsToDeselect[i];
      selected.classList.remove('selected');
    }
    return void 0;
  };

  selectEntry(entry) {
    if (entry == null) {
      return;
    }
    this.deselect();
    try {
      if (entry.classList) {
        entry.classList.add('selected');
      } else {
        entry.addClass('selected');
      }
    } catch (e) {}
    return entry;
  }

  getSelected() {
    let selected;
    selected = $('.ftp-remote-edit-view .selected');
    if (selected) {
      return selected[0];
    }
    return null;
  }

  getServerByLocalPath(pathOnFileSystem) {
    const self = this;

    return new Promise((resolve, reject) => {

      if (!self.servers) reject();
      if (!self.list) reject();

      self.servers.forEach((config) => {
        let server = new ServerView(config, self);
        let path = server.getLocalPath(true);
        if (pathOnFileSystem.indexOf(path) != -1) {
          resolve(server);
        }
      });
      reject();
    });
  }

  getElementByLocalPath(pathOnFileSystem, root, type = 'directory') {
    const self = this;

    let elementparent = null;
    let elementname = basename(pathOnFileSystem, Path.sep);
    let elementpath = dirname(pathOnFileSystem, Path.sep) + elementname;
    let dirpath = dirname(pathOnFileSystem, Path.sep);

    let a = trailingslashit(pathOnFileSystem, Path.sep);
    let b = trailingslashit(root.getLocalPath(true), Path.sep);
    if (a == b) {
      return self.getServerView(root.config, root.treeView);
    } else if (type == 'file') {
      return self.getFileView(self.getElementByLocalPath(dirpath, root), {
        name: elementname,
        path: elementpath,
        size: 0,
        rights: null
      });
    } else {
      return self.getDirectoryView(self.getElementByLocalPath(dirpath, root), {
        name: elementname,
        path: elementpath,
        rights: null
      });
    }
  }

  getServerView(config, self) {
    return new ServerView(config, self);
  }

  getDirectoryView(parent, directory) {
    return new DirectoryView(parent, directory);
  }

  getFileView(parent, file) {
    return new FileView(parent, file);
  }

  resizeHorizontalStarted(e) {
    e.preventDefault();

    this.resizeWidthStart = this.width();
    this.resizeMouseStart = e.pageX;
    $(document)
      .on('mousemove', this.resizeHorizontalView.bind(this));
    $(document)
      .on('mouseup', this.resizeHorizontalStopped);
  };

  resizeHorizontalStopped() {
    delete this.resizeWidthStart;
    delete this.resizeMouseStart;
    $(document)
      .off('mousemove', this.resizeHorizontalView);
    $(document)
      .off('mouseup', this.resizeHorizontalStopped);
  };

  resizeHorizontalView(e) {
    if (e.which !== 1) {
      return this.resizeHorizontalStopped();
    }

    let delta = e.pageX - this.resizeMouseStart;
    let width = 0;
    if (atom.config.get('ftp-remote-edit.tree.showOnRightSide')) {
      width = Math.max(50, this.resizeWidthStart - delta);
    } else {
      width = Math.max(50, this.resizeWidthStart + delta);
    }

    this.width(width);
  };

  resizeToFitContent(e) {
    if (e) e.preventDefault();

    if (atom.config.get('ftp-remote-edit.tree.showInDock')) {
      const paneContainer = atom.workspace.paneContainerForItem(this)
      // NOTE: This is an internal API access
      // It's necessary because there's no Public API for it yet
      if (paneContainer && typeof paneContainer.state.size === 'number' && paneContainer.widthOrHeight == 'width' && typeof paneContainer.render === 'function') {
        paneContainer.state.size = 1
        paneContainer.state.size = (this.list.outerWidth() + 10);
        paneContainer.render(paneContainer.state)
      }
    } else {
      this.width(1);
      this.width(this.list.outerWidth() + 10);
    }
  };

  remoteKeyboardNavigation(e) {
    let arrows = { left: 37, up: 38, right: 39, down: 40 },
      keyCode = e.keyCode || e.which;

    switch (keyCode) {
      case arrows.up:
        this.remoteKeyboardNavigationUp();
        break;
      case arrows.down:
        this.remoteKeyboardNavigationDown();
        break;
      case arrows.left:
        this.remoteKeyboardNavigationLeft();
        break;
      case arrows.right:
        this.remoteKeyboardNavigationRight();
        break;
      default:
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    this.remoteKeyboardNavigationMovePage();
  };

  remoteKeyboardNavigationUp() {
    let current = this.list.find('.selected'),
      next = current.prev('.entry:visible');
    if (next.length) {
      while (next.is('.expanded') && next.find('.entries .entry:visible').length) {
        next = next.find('.entries .entry:visible');
      }
    } else {
      next = current.closest('.entries').closest('.entry:visible');
    }
    if (next.length) {
      current.removeClass('selected');
      next.last().addClass('selected');
    }
  };

  remoteKeyboardNavigationDown() {
    let current = this.list.find('.selected'),
      next = current.find('.entries .entry:visible');
    if (!next.length) {
      tmp = current;

      // Workaorund skip after 10
      let counter = 1;
      do {
        next = tmp.next('.entry:visible');
        if (!next.length) {
          tmp = tmp.closest('.entries').closest('.entry:visible');
        }
        counter++;
      } while (!next.length && !tmp.is('.project-root') && counter < 10);
    }
    if (next.length) {
      current.removeClass('selected');
      next.first().addClass('selected');
    }
  };

  remoteKeyboardNavigationLeft() {
    const current = this.list.find('.selected');
    if (current.is('.file')) {
      parent = current.view().parent.view();
      parent.collapse();
      current.removeClass('selected');
      parent.addClass('selected');
    } else if (current.is('.directory') && current.view().isExpanded) {
      current.view().collapse();
    } else if (current.is('.directory') && !current.view().isExpanded) {
      parent = current.view().parent.view();
      parent.collapse();
      current.removeClass('selected');
      parent.addClass('selected');
    } else {
      current.view().collapse();
    }
  };

  remoteKeyboardNavigationRight() {
    const current = this.list.find('.selected');
    if (current.is('.directory') || current.is('.server')) {
      if (!current.view().isExpanded) {
        current.view().expand();
      }
    } else {
      current.view().open();
    }
  };

  remoteKeyboardNavigationMovePage() {
    const current = this.list.find('.selected');
    if (current.length) {
      let scrollerTop = this.scroller.scrollTop(),
        selectedTop = current.position().top;
      if (selectedTop < scrollerTop - 10) {
        this.scroller.pageUp();
      } else if (selectedTop > scrollerTop + this.scroller.height() - 10) {
        this.scroller.pageDown();
      }
    }
  };
}

module.exports = TreeView;
