'use babel';

import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';
import { basename, dirname, trailingslashit, normalize, permissionsToRights } from './../helper/format.js';
import { getFullExtension, createLocalPath, deleteLocalPath, isPathIgnored } from './../helper/helper.js';
import FileView from './file-view.js';

const shortHash = require('short-hash');
const md5 = require('md5');
const Path = require('path');
const FileSystem = require('fs-plus');
const Queue = require('./../helper/queue.js');
const tempDirectory = require('os').tmpdir();

class DirectoryView extends View {

  DirectoryView() {
    super.DirectoryView();
    const self = this;

    self.id = null;
    self.list = null;
    self.parent = null;
    self.config = null;
    self.name = null;
    self.rights = null;
    self.isExpanded = false;
  }

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
    self.list = null;
    self.parent = parent;
    self.config = parent.config;
    self.name = directory.name;
    self.rights = directory.rights;
    self.isExpanded = false;
    self.id = self.getId();

    self.label.text(self.name);
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
    self.on('drop', (e) => self.onDrop(e));
  }

  destroy() {
    this.remove();
  }

  getId() {
    const self = this;

    return 'ftp-remote-edit-' + md5(self.getPath(false));
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

    if (self.parent) {
      return (self.parent.getPath(useRemote) + self.name + '/').replace(/\/+/g, "/");
    }
    return ((self.config.remote && useRemote) ? '/' + self.config.remote + '/' : '/').replace(/\/+/g, "/");
  }

  getLocalPath(useRemote = true) {
    const self = this;

    if (self.parent) {
      return (self.parent.getLocalPath(useRemote) + self.name + '/').replace(/\/+/g, Path.sep);
    }
    return ((self.config.remote && useRemote) ?
      tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/' + self.config.remote + '/' :
      tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/').replace(/\/+/g, Path.sep);
  }

  paint(list) {
    const self = this;

    let entries = [];

    if (list) {
      self.list = list;
    } else {
      list = self.list;
    }
    self.entries.children().detach();

    let directories = list.filter((item) => {
      return item.type === 'd' && item.name !== '.' && item.name !== '..';
    });

    let files = list.filter((item) => {
      return item.type === '-';
    });

    directories.sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });

    files.sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });

    directories.forEach((element) => {
      let pathOnFileSystem = self.getPath() + element.name;
      pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");

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
      let pathOnFileSystem = self.getPath() + element.name;
      pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");

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
    self.getRoot().getFinderItemsCache().refreshDirectory(self.getPath(false), files);

    if (!atom.config.get('ftp-remote-edit.tree.sortFoldersBeforeFiles')) {
      entries.sort((a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
    }

    entries.forEach((entry) => {
      self.entries.append(entry);
    });
  }

  setClasses() {
    const self = this;

    if (self.isExpanded) {
      self.addClass('expanded').removeClass('collapsed');
    } else {
      self.addClass('collapsed').removeClass('expanded');
    }
  }

  expand() {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.entries.children().detach();
      self.isExpanded = true;
      self.setClasses();
      self.label.addClass('icon-sync').addClass('spin').removeClass('icon-file-directory');

      self.getRoot().connector.listDirectory(self.getPath()).then((list) => {
        self.paint(list);
        self.label.removeClass('icon-sync').removeClass('spin').addClass('icon-file-directory');
        resolve(true);
      }).catch((err) => {
        self.getRoot().connector.showMessage(err.message, 'error');
        self.label.removeClass('icon-sync').removeClass('spin').addClass('icon-file-directory');
        self.collapse();
        reject(err);
      });
    });

    return promise;
  }

  expandPath(relativePath, expandRoot = false) {
    const self = this;

    if (expandRoot) {
      let promise = new Promise((resolve, reject) => {
        self.getRoot().expand().then(() => {
          self.expandPath(relativePath, false).then(() => {
            resolve(true);
          }).catch((err) => {
            reject(err);
          });
        }).catch((err) => {
          reject(err);
        });
      });

      return promise;
    }

    let promise = new Promise((resolve, reject) => {
      let arrPath = relativePath.split('/');
      let path = "";
      let dir = "";

      let tmp = arrPath.shift();
      if (tmp == '') tmp = arrPath.shift(); // Remove Root

      dir = self.getPath(false) + tmp;
      path = '/' + arrPath.join('/');

      let find = self.find(dir);

      if (find) {
        if (find.view().is('.directory')) {
          find.view().expand().then(() => {
            if (path && path != '/') {
              find.view().expandPath(path).then((list) => {
                resolve(true);
              }).catch((err) => {
                reject(err);
              });
            } else {
              resolve(true);
            }
          }).catch((err) => {
            reject(err);
          });
        } else {
          find.view().select();
          resolve(true);
        }
      } else {
        if (dir == '' || dir == '/') {
          resolve(true);
        } else {
          reject('Path not found.');
        }
      }
    });

    return promise;
  }

  collapse() {
    const self = this;

    self.isExpanded = false;
    self.setClasses();
    self.label.removeClass('icon-sync').removeClass('spin').addClass('icon-file-directory');
  }

  toggle() {
    const self = this;

    if (self.isExpanded) {
      self.collapse();
    } else {
      self.expand().catch((err) => {
        self.getRoot().connector.showMessage(err.message, 'error');
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

  find(relativePath) {
    const self = this;

    let root = self.getRoot();
    let find = root.entries.find('li[id="' + 'ftp-remote-edit-' + md5(relativePath) + '"]');
    if (find.length > 0) {
      return find;
    }

    find = root.entries.find('li[id="' + 'ftp-remote-edit-' + md5(relativePath + '/') + '"]');
    if (find.length > 0) {
      return find;
    }

    return null;
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

    if (entry = e.target.closest('.entry')) {
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

    let entry, header, initialType;

    if (header = e.target.closest('.entry.directory > .header')) {
      console.log('d enter', header);
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
      $(entry).view().select();
    }
  }

  onDragLeave(e) {
    const self = this;

    let entry, header, initialType;

    if (header = e.target.closest('.entry.directory > .header')) {
      console.log('d leave', header);
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
      $(entry).view().deselect();
    }
  }

  onDrop(e) {
    const self = this;

    let entry, initialPath, initialType, initialName, newDirectoryPath, ref;

    window.sessionStorage.removeItem('ftp-remote-edit:dragPath');
    window.sessionStorage.removeItem('ftp-remote-edit:dragName');
    window.sessionStorage.removeItem('ftp-remote-edit:dragType');
    window.sessionStorage.removeItem('ftp-remote-edit:dropPath');
    window.sessionStorage.removeItem('ftp-remote-edit:dragFiles');

    if (entry = e.target.closest('.entry')) {
      e.preventDefault();
      e.stopPropagation();

      if (!entry.classList.contains('server') && !entry.classList.contains('directory')) {
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
        // Drop event from Atom
        if (initialType == "directory") {
          window.sessionStorage['ftp-remote-edit:dragPath'] = initialPath;
          window.sessionStorage['ftp-remote-edit:dragName'] = initialName;
          window.sessionStorage['ftp-remote-edit:dragType'] = initialType;
          window.sessionStorage['ftp-remote-edit:dropPath'] = newDirectoryPath + initialName + '/';

          atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:paste');
        } else if (initialType == "file") {
          window.sessionStorage['ftp-remote-edit:dragPath'] = initialPath;
          window.sessionStorage['ftp-remote-edit:dragName'] = initialName;
          window.sessionStorage['ftp-remote-edit:dragType'] = initialType;
          window.sessionStorage['ftp-remote-edit:dropPath'] = newDirectoryPath + initialName;

          atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:paste');
        }
      } else {
        // Drop event from OS
        if (e.dataTransfer) {
          ref = e.dataTransfer.files;
        } else {
          ref = e.originalEvent.dataTransfer.files;
        }

        let files = [];
        for (let i = 0; i < ref.length; i++) {
          files.push(ref[i].path);
        }

        window.sessionStorage['ftp-remote-edit:dragFiles'] = JSON.stringify(files);

        atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:paste');
      }
    }
  }
}

module.exports = DirectoryView;
