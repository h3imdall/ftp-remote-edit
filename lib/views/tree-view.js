'use babel';

import { $, ScrollView } from 'atom-space-pen-views';
import { basename, dirname, leadingslashit, trailingslashit, unleadingslashit, untrailingslashit, normalize, cleanJsonString } from './../helper/format.js';
import { decrypt } from './../helper/secure.js';
import { resetIgnoredPatterns, resetIgnoredFinderPatterns, permissionsToRights } from './../helper/helper.js';
import { throwErrorIssue44 } from './../helper/issue.js';
import ServerView from './server-view.js';
import FolderView from './folder-view.js';
import DirectoryView from './directory-view.js';
import FileView from './file-view.js';
import FtpLogView from './ftp-log-view.js';

const md5 = require('md5');
const Path = require('path');
const FileSystem = require('fs-plus');
const Storage = require('./../helper/storage.js');
const FTP_REMOTE_EDIT_URI = 'h3imdall://ftp-remote-edit';

class TreeView extends ScrollView {

  static content() {
    return this.div({
      class: 'ftp-remote-edit-view ftp-remote-edit-resizer tool-panel',
      'tabIndex ': '-1',
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
  }

  serialize() {
    return {};
  }

  initialize(state) {
    super.initialize(state)
    const self = this;

    let html = '<background-tip>';
    html += '<ul class="centered background-message">';
    html += '<li class="message fade-in">You can edit the servers from the Settings View with ftp-remote-edit:edit-servers or add one by using URI handler<br/><br/><a role="configure" class="btn btn-xs btn-default icon">Edit Servers</a></li>';
    html += '</ul>';
    html += '</background-tip>';
    self.info.html(html);

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
      let entry;
      if (entry = e.target.closest('.entry')) {
        e.stopPropagation();

        setTimeout(function () {
          $(entry).view().select();
          self.focus();
        }, 10);
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
    self.on('keydown', (e) => { self.remoteKeyboardNavigation(e); });
  }

  destroy() {
    const self = this;

    if (self.list) {
      if (self.list.children()) {
        self.list.children().detach();
      }
    }
    self.remove();
  }

  getTitle() {
    return "Remote";
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
  }

  detach() {
    const self = this;

    if (self.panel) {
      self.panel.destroy();
      self.panel = null;
    }
  }

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
  }

  show() {
    atom.workspace.open(this, {
      searchAllPanes: true,
      activatePane: true,
      activateItem: true,
    }).then(() => {
      atom.workspace.paneContainerForURI(this.getURI()).show()
    });
  }

  hide() {
    atom.workspace.hide(this)
  }

  focus() {
    $(this).focus();
  }

  unfocus() {
    atom.workspace.getCenter().activate()
  }

  hasFocus() {
    return (document.activeElement === this.element);
  }

  toggleFocus() {
    if (this.hasFocus()) {
      this.unfocus()
    } else {
      this.show();
    }
  }

  showInfo() {
    this.info.css('display', 'flex');
  }

  hideInfo() {
    this.info.hide();
  }

  toggleInfo() {
    const self = this;
    if (self.list.children().length > 0) {
      self.hideInfo();
    } else {
      self.showInfo();
    }
  }

  reload() {
    const self = this;

    self.list.children().detach();

    Storage.getTree().children.forEach((config) => {
      if (typeof config.children !== 'undefined') {
        self.addFolder(config);
      } else {
        self.addServer(config);
      }
    });

    self.toggleInfo();
  }

  addServer(config) {
    const self = this;

    let server = new ServerView(config);

    // Events
    server.getConnector().on('log', (msg) => {
      self.ftpLogView.addLine(msg);
    });

    server.getConnector().on('debug', (cmd, param1, param2) => {
      if (atom.config.get('ftp-remote-edit.dev.debug')) {
        if (param1 && param2) {
          console.log(cmd, param1, param2);
        } else if (param1) {
          console.log(cmd, param1);
        } else if (cmd) console.log(cmd);
      }
    });

    self.list.append(server);
  }

  addFolder(config) {
    const self = this;

    let folder = new FolderView(config, self);

    // Events
    folder.onDidAddServer = (server) => {
      server.getConnector().on('log', (msg) => {
        self.ftpLogView.addLine(msg);
      });

      server.getConnector().on('debug', (cmd, param1, param2) => {
        if (atom.config.get('ftp-remote-edit.dev.debug')) {
          if (param1 && param2) {
            console.log(cmd, param1, param2);
          } else if (param1) {
            console.log(cmd, param1);
          } else if (cmd) console.log(cmd);
        }
      });
    };

    self.list.append(folder);

  }

  addDirectory(root, relativePath, options = {}) {
    const self = this;

    if (!options.rights) options.rights = permissionsToRights('644');

    if (relativePath == '/') return root;

    let tmp = leadingslashit(relativePath).split('/');
    let element = tmp.shift();
    let elementPath = normalize(root.getPath(false) + trailingslashit(element));

    let directory = self.findElementByPath(root.getRoot(), elementPath);
    if (!directory) {
      directory = new DirectoryView(root, {
        name: element,
        rights: options.rights
      });
      root.entries.append(directory);

      if (root.isExpanded()) {
        root.refresh(root);
      }
    }

    if (tmp.length > 0) {
      return self.addDirectory(directory, tmp.join('/'));
    } else {
      return directory;
    }
  }

  addFile(root, relativePath, options = {}) {
    const self = this;

    if (!options.size) options.size = 0;
    if (!options.rights) options.rights = permissionsToRights('755');

    if (relativePath == '/') return root;

    let tmp = leadingslashit(relativePath).split('/');
    let element = tmp.pop();
    let elementPath = normalize(root.getPath(false) + element);

    if (tmp.length > 0) {
      root = self.addDirectory(root, tmp.join('/'));
      elementPath = normalize(root.getPath(false) + element);
    }

    let file = self.findElementByPath(root.getRoot(), elementPath);
    if (!file) {
      file = new FileView(root, {
        name: element,
        size: options.size,
        rights: options.rights
      });
      root.entries.append(file);

      if (root.isExpanded()) {
        root.refresh(root)
      }
    }

    return file;
  }

  getRoot() {
    const self = this;

    return self;
  }

  expand(root, relativePath) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      relativePath = leadingslashit(normalize(relativePath));
      if (relativePath == '' || relativePath == '/') {
        root.select();
        resolve(true);
      }

      root.getRoot().expand().then(() => {
        let arrPath = relativePath.split('/');
        let dir = trailingslashit(normalize(root.getPath(false) + arrPath.shift()));
        let newRelativePath = arrPath.join('/');

        let find = self.findElementByPath(root.getRoot(), dir);
        if (find) {
          if (find.is('.directory')) {
            find.expand().then(() => {
              if (newRelativePath && newRelativePath != '/') {
                self.expand(find, newRelativePath).then(() => {
                  resolve(true);
                }).catch((err) => {
                  reject(err);
                });
              } else {
                find.select();
                resolve(true);
              }
            }).catch((err) => {
              reject(err);
            });
          } else {
            find.select();
            resolve(true);
          }
        } else {
          reject('Path not found.');
        }
      }).catch((err) => {
        reject(err);
      });
    });

    return promise;
  }

  getElementByLocalPath(pathOnFileSystem, root, type = 'directory') {
    const self = this;

    pathOnFileSystem = normalize(pathOnFileSystem, Path.sep);
    let elementname = basename(pathOnFileSystem, Path.sep);
    let elementpath = dirname(pathOnFileSystem, Path.sep) + elementname;
    let dirpath = dirname(pathOnFileSystem, Path.sep);

    let a = trailingslashit(pathOnFileSystem, Path.sep);
    let b = trailingslashit(root.getLocalPath(true), Path.sep);
    if (a == b) {
      return new ServerView(root.config, root.treeView);
    } else if (type == 'file') {
      if (FileSystem.existsSync(elementpath)) {
        let stats = FileSystem.statSync(elementpath);
        if (stats) {
          return new FileView(self.getElementByLocalPath(dirpath, root), {
            name: elementname,
            path: elementpath,
            size: stats.size,
            rights: null
          });
        } else {
          return new FileView(self.getElementByLocalPath(dirpath, root), {
            name: elementname,
            path: elementpath,
            size: 0,
            rights: null
          });
        }
      } else {
        return new FileView(self.getElementByLocalPath(dirpath, root), {
          name: elementname,
          path: elementpath,
          size: 0,
          rights: null
        });
      }
    } else {
      return new DirectoryView(self.getElementByLocalPath(dirpath, root), {
        name: elementname,
        path: elementpath,
        rights: null
      });
    }
  }

  findElementByPath(root, relativePath) {
    const self = this;

    let find = root.entries.find('li[id="' + 'ftp-remote-edit-' + md5(relativePath) + '"]');
    if (find.length > 0) {
      return find.view();
    }

    find = root.entries.find('li[id="' + 'ftp-remote-edit-' + md5(relativePath + '/') + '"]');
    if (find.length > 0) {
      return find.view();
    }

    return null;
  }

  findElementByLocalPath(pathOnFileSystem) {
    const self = this;

    pathOnFileSystem = trailingslashit(normalize(pathOnFileSystem, Path.sep));

    if (!Storage.getServers()) return;
    if (!self.list) return;

    let found = null;
    Storage.getServers().forEach((config) => {
      const server = new ServerView(config, self);
      const path = server.getLocalPath(true);

      if (pathOnFileSystem.indexOf(path) != -1) {
        const object = {
          config: server.config,
          name: server.name,
          path: server.getPath(false),
        };

        let findRoot = self.list.find('li[id="' + 'ftp-remote-edit-' + md5(JSON.stringify(object)) + '"]');
        if (findRoot.length > 0) {
          const root = findRoot.view();
          const relativePath = pathOnFileSystem.replace(root.getLocalPath(), '');
          const find = self.findElementByPath(root.getRoot(), normalize(unleadingslashit(relativePath), '/'));
          if (find) {
            found = find;
            return;
          }
        }
      }
    });

    return found;

  }

  resizeHorizontalStarted(e) {
    e.preventDefault();

    this.resizeWidthStart = this.width();
    this.resizeMouseStart = e.pageX;
    $(document).on('mousemove', this.resizeHorizontalView.bind(this));
    $(document).on('mouseup', this.resizeHorizontalStopped);
  }

  resizeHorizontalStopped() {
    delete this.resizeWidthStart;
    delete this.resizeMouseStart;
    $(document).off('mousemove', this.resizeHorizontalView);
    $(document).off('mouseup', this.resizeHorizontalStopped);
  }

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
  }

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
  }

  remoteKeyboardNavigation(e) {
    let arrows = { left: 37, up: 38, right: 39, down: 40, enter: 13 };
    let keyCode = e.keyCode || e.which;

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
      case arrows.enter:
        this.remoteKeyboardNavigationEnter();
        break;
      default:
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    this.remoteKeyboardNavigationMovePage();
  }

  remoteKeyboardNavigationUp() {
    let current = this.list.find('.selected');
    if (current.length === 0) {
      if (this.list.children().length > 0) {
        current = this.list.children().last();
        $(current).view().select();
        return;
      }
    }
    let next = current.prev('.entry:visible');

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
  }

  remoteKeyboardNavigationDown() {
    let current = this.list.find('.selected');
    if (current.length === 0) {
      if (this.list.children().length > 0) {
        current = this.list.children().first();
        $(current).view().select();
        return;
      }
    }
    let next = current.find('.entries .entry:visible');

    if (!next.length) {
      tmp = current;

      // Workaround skip after 10
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
  }

  remoteKeyboardNavigationLeft() {
    const current = this.list.find('.selected');

    if (current.is('.file')) {
      parent = current.view().parent.view();
      parent.collapse();
      current.removeClass('selected');
      parent.addClass('selected');
    } else if (current.is('.directory') && current.view().isExpanded()) {
      current.view().collapse();
    } else if (current.is('.directory') && !current.view().isExpanded()) {
      parent = current.view().parent.view();
      parent.collapse();
      current.removeClass('selected');
      parent.addClass('selected');
    } else if (current.is('.folder') && current.view().isExpanded()) {
      current.view().collapse();
    } else if (current.is('.folder') && !current.view().isExpanded() && current.view().parent.is('.folder')) {
      parent = current.view().parent.view();
      parent.collapse();
      current.removeClass('selected');
      parent.addClass('selected');
    } else if (current.is('.server')) {
      if (current.view().isExpanded()) {
        current.view().collapse();
      }
    }
  }

  remoteKeyboardNavigationRight() {
    const current = this.list.find('.selected');

    if (current.is('.directory') || current.is('.server') || current.is('.folder')) {
      if (!current.view().isExpanded()) {
        current.view().expand();
      }
    } else if (current.is('.file')) {
      if (atom.config.get('ftp-remote-edit.tree.allowPendingPaneItems')) {
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:open-file-pending');
      } else {
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:open-file');
      }
    }
  }

  remoteKeyboardNavigationMovePage() {
    const current = this.list.find('.selected');

    if (current.length > 0) {
      let scrollerTop = this.scroller.scrollTop(),
        selectedTop = current.position().top;
      if (selectedTop < scrollerTop - 10) {
        this.scroller.pageUp();
      } else if (selectedTop > scrollerTop + this.scroller.height() - 10) {
        this.scroller.pageDown();
      }
    }
  }

  remoteKeyboardNavigationEnter() {
    const current = this.list.find('.selected');

    if (current.is('.directory') || current.is('.server')) {
      if (!current.view().isExpanded()) {
        current.view().expand();
      } else {
        current.view().collapse();
      }
    } else if (current.is('.file')) {
      if (atom.config.get('ftp-remote-edit.tree.allowPendingPaneItems')) {
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:open-file-pending');
      } else {
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:open-file');
      }
    }
  }
}

module.exports = TreeView;
