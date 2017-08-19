'use babel';

import ServerView from './server-view.js';
import FtpLogView from './ftp-log-view.js';
import { $, ScrollView } from 'atom-space-pen-views';
import { decrypt, encrypt, checkPassword, setPassword } from './../helper/secure.js';
import { cleanJsonString } from './../helper/format.js';

const resizeCursor = process.platform === 'win32' ? 'ew-resize' : 'col-resize';
const FTP_REMOTE_EDIT_URI = 'h3imdall://ftp-remote-edit';
let Minimatch = null // Defer requiring until actually needed

class TreeView extends ScrollView {

  TreeView() {
    super.TreeView();

    const self = this;
    self.servers = null;
    self.ignoredPatterns = [];
  };

  static content() {
    return this.div({
      class: 'ftp-remote-edit-view ftp-remote-edit-resizer tool-panel',
      'data-show-on-right-side': atom.config.get('ftp-remote-edit.showOnRightSide'),
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
    if (atom.config.get('ftp-remote-edit.showOnRightSide')) {
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

    self.ignoredPatterns = self.loadIgnoredPatterns();

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
    atom.config.onDidChange('ftp-remote-edit.showOnRightSide', () => {
      self.element.dataset.showOnRightSide = atom.config.get('ftp-remote-edit.showOnRightSide');
      if (self.isVisible() && atom.config.get('ftp-remote-edit.showInDock') == false) {
        self.detach();
        self.attach();
      }
    });
    atom.config.onDidChange('ftp-remote-edit.sortFoldersBeforeFiles', () => {
      if (self.isVisible()) {
        self.reload();
      }
    });
    atom.config.onDidChange('ftp-remote-edit.hideIgnoredNames', () => {
      self.ignoredPatterns = self.loadIgnoredPatterns();
      if (self.isVisible()) {
        self.reload();
      }
    });
    atom.config.onDidChange('core.ignoredNames', () => {
      self.ignoredPatterns = self.loadIgnoredPatterns();
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

    if (atom.config.get('ftp-remote-edit.showOnRightSide')) {
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

    if (atom.config.get('ftp-remote-edit.showInDock')) {
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

  loadIgnoredPatterns() {
    const self = this;
    var ignoredName, ignoredNames, i, len, results;
    let ignoredPatterns = [];

    if (!atom.config.get('ftp-remote-edit.hideIgnoredNames')) {
      return;
    }

    if (Minimatch == null) {
      Minimatch = require('minimatch')
        .Minimatch;
    }

    ignoredNames = (atom.config.get('core.ignoredNames')) != null ? atom.config.get('core.ignoredNames') : [];
    if (typeof ignoredNames === 'string') {
      ignoredNames = [ignoredNames];
    }
    results = [];
    for (i = 0, len = ignoredNames.length; i < len; i++) {
      ignoredName = ignoredNames[i];
      if (ignoredName) {
        try {
          ignoredPatterns.push(new Minimatch(ignoredName, {
            matchBase: true,
            dot: true
          }));
        } catch (err) {
          console.log("Ftp-Remote-Edit: Error parsing ignore pattern (" + ignoredName + ")");
        }
      }
    }
    return ignoredPatterns;
  }

  loadServers(password) {
    const self = this;

    let configHash = atom.config.get('ftp-remote-edit.config');
    if (configHash) {
      let config = decrypt(password, configHash);
      self.servers = JSON.parse(cleanJsonString(config));
      self.servers.sort(function (a, b) {
        if (a.host < b.host) return -1;
        if (a.host > b.host) return 1;
        return 0;
      });
    }
  }

  reload() {
    const self = this;

    if (!self.servers) {
      self.list.children()
        .detach();
      self.showInfo();
      return;
    }

    self.list.children()
      .detach();
    self.hideInfo();
    self.servers.forEach((config) => {
      let server = new ServerView(config, self);
      self.list.append(server);
    });
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
    entry.classList.add('selected');
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
    if (atom.config.get('ftp-remote-edit.showOnRightSide')) {
      width = Math.max(50, this.resizeWidthStart - delta);
    } else {
      width = Math.max(50, this.resizeWidthStart + delta);
    }

    this.width(width);
  };

  resizeToFitContent(e) {
    if (e) e.preventDefault();

    if (atom.config.get('ftp-remote-edit.showInDock')) {
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
      while (next.is('.expanded') && next.find('.entries .entry:visible')
        .length) {
        next = next.find('.entries .entry:visible');
      }
    } else {
      next = current.closest('.entries')
        .closest('.entry:visible');
    }
    if (next.length) {
      current.removeClass('selected');
      next.last()
        .addClass('selected');
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
          tmp = tmp.closest('.entries')
            .closest('.entry:visible');
        }
        counter++;
      } while (!next.length && !tmp.is('.project-root') && counter < 10);
    }
    if (next.length) {
      current.removeClass('selected');
      next.first()
        .addClass('selected');
    }
  };

  remoteKeyboardNavigationLeft() {
    const current = this.list.find('.selected');
    if (!current.is('.directory')) {
      next = current.closest('.directory');
      next.view()
        .collapse();
      current.removeClass('selected');
      next.first()
        .addClass('selected');
    } else if (!current.view()
      .isExpanded && current.view()
      .parent) {
      parent = current.view()
        .parent.view();
      parent.collapse();
      current.removeClass('selected');
      parent.addClass('selected');
    } else {
      current.view()
        .collapse();
    }
  };

  remoteKeyboardNavigationRight() {
    const current = this.list.find('.selected');
    if (current.is('.directory')) {
      if (!current.view()
        .isExpanded) {
        const view = current.view();
        view.expand();
      }
    } else {
      const view = current.view();
      view.open();
    }
  };

  remoteKeyboardNavigationMovePage() {
    const current = this.list.find('.selected');
    if (current.length) {
      let scrollerTop = this.scroller.scrollTop(),
        selectedTop = current.position()
        .top;
      if (selectedTop < scrollerTop - 10) {
        this.scroller.pageUp();
      } else if (selectedTop > scrollerTop + this.scroller.height() - 10) {
        this.scroller.pageDown();
      }
    }
  };
}

module.exports = TreeView;
