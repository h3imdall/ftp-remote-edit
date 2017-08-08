'use babel';

import Connector from './../connectors/connector.js';
import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';
import { basename, trailingslashit } from './../helper/format.js';
import FileView from './file-view.js';

let FileSystem = require('fs');
const tempDirectory = require('os')
  .tmpdir();

class DirectoryView extends View {

  DirectoryView() {
    super.DirectoryView();

    const self = this;

    self.list = null;
    self.parent = null;
    self.config = null;
    self.name = '';
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
  };

  initialize(parent, directory) {
    const self = this;

    self.list = null;
    self.parent = parent;
    self.config = parent.config;
    self.name = directory.name;
    self.isExpanded = false;

    self.label.text(self.name);
    self.label.addClass('icon-file-directory');

    self.attr('data-name', self.name);
    self.attr('data-host', self.config.host);

    // Events
    self.on('click', function (e) {
      e.stopPropagation();
      self.toggle();
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();
    });

    // Drag & Drop
    self.on('dragstart', (e) => self.onDragStart(e));
    self.on('dragenter', (e) => self.onDragEnter(e));
    self.on('dragleave', (e) => self.onDragLeave(e));
    self.on('drop', (e) => self.onDrop(e));
  };

  destroy() {
    this.remove();
  };

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
      return (self.parent.getPath(useRemote) + self.name + '/')
        .replace(/\/+/g, "/");
    }
    return ((self.config.remote && useRemote) ? '/' + self.config.remote + '/' : '/')
      .replace(/\/+/g, "/");
  }

  getLocalPath(useRemote = true) {
    const self = this;

    if (self.parent) {
      return (self.parent.getLocalPath(useRemote) + self.name + '/')
        .replace(/\/+/g, "/");
    }
    return ((self.config.remote && useRemote) ? tempDirectory + '/' + self.config.host + '/' + self.config.remote + '/' :
        tempDirectory + '/' + self.config.host + '/')
      .replace(/\/+/g, "/");
  }

  paint(list) {
    const self = this;
    let entries = [];

    if (list) {
      self.list = list;
    } else {
      list = self.list;
    }
    self.entries.children()
      .detach();

    let directories = list.filter((item) => {
      return item.type === 'd' && item.name !== '.' && item.name !== '..';
    });
    let files = list.filter((item) => {
      return item.type === '-';
    });

    directories.sort(function (a, b) {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });

    files.sort(function (a, b) {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });

    directories.forEach(function (element) {
      let pathOnFileSystem = self.getPath() + element.name;
      pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");

      let li = new DirectoryView(self, {
        name: element.name,
        path: pathOnFileSystem
      });
      entries.push(li);
    }, this);

    files.forEach(function (element) {
      let pathOnFileSystem = self.getPath() + element.name;
      pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");

      let li = new FileView(self, {
        name: element.name,
        path: pathOnFileSystem
      });
      entries.push(li);
    }, this);

    if (!atom.config.get('ftp-remote-edit.sortFoldersBeforeFiles')) {
      entries.sort(function (a, b) {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
    }

    entries.forEach(function (entry) {
      self.entries.append(entry);
    });
  };

  setClasses() {
    const self = this;

    if (self.isExpanded) {
      self.addClass('expanded')
        .removeClass('collapsed');
    } else {
      self.addClass('collapsed')
        .removeClass('expanded');
    }
  };

  expand() {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.isExpanded = true;
      self.setClasses();
      self.label.addClass('icon-sync')
        .addClass('spin')
        .removeClass('icon-file-directory');
      self.deselect();
      self.select(self);

      self.getRoot()
        .connector.listDirectory(self.getPath())
        .then((list) => {
          self.paint(list);
          self.label.removeClass('icon-sync')
            .removeClass('spin')
            .addClass('icon-file-directory');
          resolve(true);
        })
        .catch(function (err) {
          self.getRoot()
            .connector.showMessage(err.message, 'error');
          self.label.removeClass('icon-sync')
            .removeClass('spin')
            .addClass('icon-file-directory');
          self.collapse();
          reject(err);
        });
    });

    return promise;
  };

  expandPath(relativePath, expandRoot = false) {
    const self = this;

    if (expandRoot) {
      let promise = new Promise((resolve, reject) => {
        self.getRoot()
          .expand()
          .then(() => {
            self.expandPath(relativePath, false)
              .then(() => {
                resolve(true);
              })
              .catch(function (err) {
                reject(err);
              });
          })
          .catch(function (err) {
            reject(err);
          });
      })

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
        find.view()
          .expand()
          .then(() => {
            if (path && path != '/') {
              find.view()
                .expandPath(path)
                .then((list) => {
                  resolve(true);
                })
                .catch(function (err) {
                  reject(err);
                });
            } else {
              resolve(true);
            }
          })
          .catch(function (err) {
            reject(err);
          });
      } else {
        if (dir == '' || dir == '/') {
          resolve(true);
        } else {
          reject({ message: 'Path not found.' });
        }
      }
    });

    return promise;
  };

  collapse() {
    const self = this;

    self.isExpanded = false;
    self.setClasses();
    self.entries.children()
      .detach();
    self.label.removeClass('icon-sync')
      .removeClass('spin')
      .addClass('icon-file-directory');
  };

  toggle() {
    const self = this;

    if (self.isExpanded) {
      self.collapse();
    } else {
      self.expand()
        .catch(function (err) {
          self.getRoot()
            .connector.showMessage(err.message, 'error');
        })
    }
  };

  select(elementToSelect) {
    elementToSelect[0].classList.add('selected');
  }

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

  find(relativePath) {
    const self = this;

    let pathArr = relativePath.trim()
      .split('/');
    pathArr.shift();
    let search = pathArr.map(function (item) { return 'li[data-name="' + item + '"]'; })
      .join(" ");
    let root = self.getRoot();
    let find = root.entries.find(search);
    if (find.length > 0) {
      return find;
    }
    return null;
  }

  newFile(relativePath) {
    const self = this;
    let arrPath = relativePath.split('/');
    let file = arrPath.pop();
    let dir = arrPath.join('/')
      .trim();
    let fullRelativePath = ('/' + self.config.remote + '/' + relativePath)
      .replace(/\/+/g, "/");

    self.getRoot()
      .connector.uploadFile('', fullRelativePath.trim(), null)
      .then(() => {
        if (!dir) dir = '/';
        self.getRoot()
          .expandPath(dir, true)
          .then(() => {
            let find = self.getRoot()
              .find(relativePath);
            if (find) {
              self.deselect();
              self.select(find);
              find.view()
                .open();
            }
          })
          .catch(function (err) {
            self.getRoot()
              .connector.showMessage(err.message, 'error');
          });
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  newDirectory(relativePath) {
    const self = this;
    let fullRelativePath = ('/' + self.config.remote + '/' + relativePath)
      .replace(/\/+/g, "/");

    self.getRoot()
      .connector.createDirectory(fullRelativePath.trim())
      .then((result) => {
        self.getRoot()
          .expandPath(relativePath.trim(), true)
          .catch(function (err) {
            self.getRoot()
              .connector.showMessage(err.message, 'error');
          });
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  rename(relativePath) {
    const self = this;
    let fullRelativePath = ('/' + self.config.remote + '/' + relativePath)
      .replace(/\/+/g, "/");

    self.getRoot()
      .connector.rename(self.getPath(), fullRelativePath.trim())
      .then(() => {
        let pathArr = relativePath.trim()
          .split('/');

        self.name = pathArr.pop();
        self.label.text(self.name);
        self.attr('data-name', self.name);
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  moveDirectory(initialPath, newDirectoryPath) {
    const self = this;

    let src = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + initialPath)
      .replace(/\/+/g, "/");
    let dest = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + newDirectoryPath)
      .replace(/\/+/g, "/");

    self.getRoot()
      .connector.rename(src.trim(), dest.trim())
      .then(() => {
        // Remove old object
        let oldObject = self.getRoot()
          .find(trailingslashit(initialPath));
        if (oldObject) oldObject.remove()

        // Add new object
        let elementname = basename(dest);
        let pathOnFileSystem = self.getPath() + elementname;
        pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");
        let newObject = new DirectoryView(self, {
          name: elementname,
          path: pathOnFileSystem
        });
        self.entries.append(newObject);
        if (self.isExpanded) {
          self.deselect();
          self.select(newObject);
        }
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  moveFile(initialPath, newDirectoryPath) {
    const self = this;

    let src = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + initialPath)
      .replace(/\/+/g, "/");
    let dest = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + newDirectoryPath)
      .replace(/\/+/g, "/");

    self.getRoot()
      .connector.rename(src.trim(), dest.trim())
      .then(() => {
        // Remove old object
        let oldObject = self.getRoot()
          .find(trailingslashit(initialPath));
        if (oldObject) oldObject.remove()

        // Add new object
        let elementname = basename(dest);
        let pathOnFileSystem = self.getPath() + elementname;
        pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");
        let newObject = new FileView(self, {
          name: elementname,
          path: pathOnFileSystem
        });
        self.entries.append(newObject);
        if (self.isExpanded) {
          self.deselect();
          self.select(newObject);
        }
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  upload(initialPath, newDirectoryPath) {
    console.log('upload', initialPath, newDirectoryPath);
  }

  delete(recursive) {
    const self = this;

    self.getRoot()
      .connector.deleteDirectory(self.getPath(), recursive)
      .then(() => {
        self.destroy();
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  onDragStart(e) {
    const self = this;
    let entry, initialPath;
    self.draggedObject = null;

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
  };

  onDragEnter(e) {
    const self = this;
    let entry, header, initialType;

    if (header = e.target.closest('.entry.directory > .header')) {
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

    if (header = e.target.closest('.entry.directory > .header')) {
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
    let entry, file, i, initialPath, initialName, len, newDirectoryPath, ref;

    if (entry = e.target.closest('.entry')) {
      e.preventDefault();
      e.stopPropagation();

      entry.classList.remove('selected');
      if (!entry.classList.contains('directory')) {
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

module.exports = DirectoryView;
