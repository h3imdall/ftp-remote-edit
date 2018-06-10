'use babel';

import Connector from './../connectors/connector.js';
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
  };

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
        .replace(/\/+/g, Path.sep);
    }
    return ((self.config.remote && useRemote) ? tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/' + self.config.remote + '/' :
        tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/')
      .replace(/\/+/g, Path.sep);
  }

  getElementByLocalPath(pathOnFileSystem) {
    const self = this;

    let elementname = basename(pathOnFileSystem, Path.sep);
    let elementpath = dirname(pathOnFileSystem, Path.sep) + elementname;
    let dirpath = dirname(pathOnFileSystem, Path.sep);
    let elementsize = 0;

    let elementparent = self.getRoot()
      .treeView.getElementByLocalPath(dirpath, self.getRoot());
    if (!elementparent) return null;

    let element = new DirectoryView(elementparent, {
      name: elementname,
      path: elementpath,
      rights: null
    });

    return element;
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

      if (!isPathIgnored(pathOnFileSystem)) {
        let li = new DirectoryView(self, {
          name: element.name,
          path: pathOnFileSystem,
          rights: element.rights
        });
        entries.push(li);
      }
    }, this);

    files.forEach(function (element) {
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
      self.entries.children()
        .detach();
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
        if (find.view()
          .is('.directory')) {

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
          self.getRoot()
            .treeView.selectEntry(find.view());
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
  };

  collapse() {
    const self = this;

    self.isExpanded = false;
    self.setClasses();
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
      var e = elementToRefresh.entries[0].childNodes;
      [].slice.call(e)
        .sort(function (a, b) {
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
        })
        .forEach(function (val, index) {
          self.entries.append(val);
        });
    }
  }

  newFile(relativePath) {
    const self = this;
    let arrPath = relativePath.split('/');
    let file = arrPath.pop();
    let dir = arrPath.join('/')
      .trim();

    let fullRelativePath = ('/' + self.config.remote + '/' + relativePath)
      .replace(/\/+/g, "/");

    let fullLocalPath = (self.getRoot()
        .getLocalPath(true) + relativePath.replace(/^\//, "")
        .replace(/\/+/g, Path.sep))
      .replace(/\/+/g, Path.sep);

    // Add to Upload Queue
    let queueItem = Queue.addFile({
      direction: "upload",
      remotePath: fullRelativePath,
      localPath: fullLocalPath,
      size: 0
    });

    // create local file
    try {
      if (!FileSystem.existsSync(fullLocalPath)) {
        FileSystem.writeFileSync(fullLocalPath, '');
      }
    } catch (err) {}

    self.getRoot()
      .connector.existsFile(fullRelativePath.trim())
      .then((result) => {
        self.getRoot()
          .connector.showMessage('File ' + relativePath.trim() + ' already exists', 'error');
        return;
      })
      .catch(function (err) {
        return self.getRoot()
          .connector.uploadFile(queueItem)
          .then(() => {
            // Refresh cache
            self.getRoot().getFinderItemsCache().addFile(relativePath, 0);

            let parentPath = normalize('/' + trailingslashit(dirname(relativePath)));
            let parentObject = null;
            if (parentPath == '/') {
              parentObject = self.getRoot();
            } else {
              parentObject = self.getRoot()
                .find(parentPath);
              if (parentObject) {
                parentObject = parentObject.view();
              }
            }

            if (parentObject) {
              let elementname = basename(relativePath);
              let pathOnFileSystem = normalize(parentObject.getLocalPath(true) + elementname, Path.sep);
              let newObject = new FileView(parentObject, {
                name: elementname,
                path: pathOnFileSystem,
                size: 0,
                rights: null
              });
              parentObject.entries.append(newObject);
              if (parentObject.isExpanded) {
                parentObject.refresh(parentObject)
                parentObject.deselect();
                parentObject.select(newObject);
              }
              newObject.open();
            }
          })
          .catch(function (err) {
            queueItem.changeStatus('Error');
            self.getRoot()
              .connector.showMessage(err.message, 'error');
          });
      });
  }

  newDirectory(relativePath) {
    const self = this;
    let fullRelativePath = ('/' + self.config.remote + '/' + relativePath)
      .replace(/\/+/g, "/");

    self.getRoot()
      .connector.existsDirectory(fullRelativePath.trim())
      .then((result) => {
        self.getRoot()
          .connector.showMessage('Directory ' + relativePath.trim() + ' already exists', 'error');
        return;
      })
      .catch(function (err) {
        return self.getRoot()
          .connector.createDirectory(fullRelativePath.trim())
          .then((result) => {
            let parentPath = normalize('/' + trailingslashit(dirname(relativePath)));
            let parentObject = null;
            if (parentPath == '/') {
              parentObject = self.getRoot();
            } else {
              parentObject = self.getRoot()
                .find(parentPath);
              if (parentObject) {
                parentObject = parentObject.view();
              }
            }

            if (parentObject) {
              let elementname = basename(relativePath);
              let pathOnFileSystem = normalize(parentObject.getLocalPath(true) + elementname, Path.sep);
              let newObject = new DirectoryView(parentObject, {
                name: elementname,
                path: pathOnFileSystem,
                rights: null
              });
              parentObject.entries.append(newObject);
              if (parentObject.isExpanded) {
                parentObject.refresh(parentObject)
                parentObject.deselect();
                parentObject.select(newObject);
              }
            }
          })
          .catch(function (err) {
            self.getRoot()
              .connector.showMessage(err.message, 'error');
          });
      });
  }

  renameDirectory(relativePath) {
    const self = this;
    let fullRelativePath = ('/' + self.config.remote + '/' + relativePath)
      .replace(/\/+/g, "/");

    self.getRoot()
      .connector.rename(self.getPath(), fullRelativePath.trim())
      .then(() => {
        // Refresh cache
        self.getRoot().getFinderItemsCache().renameDirectory(self.getPath(false), relativePath + '/');

        // get info from old object
        let oldObject = self;
        let dirinfo = {
          size: 0,
          rights: null
        };
        if (oldObject) {
          dirinfo.rights = oldObject.rights;
        }

        // Add new object
        let parentPath = ('/' + trailingslashit(dirname(relativePath)))
          .replace(/\/+/g, "/");
        let parentObject = null;
        if (parentPath == '/') {
          parentObject = self.getRoot();
        } else {
          parentObject = self.getRoot()
            .find(parentPath);
          if (parentObject) {
            parentObject = parentObject.view();
          }
        }

        if (parentObject) {
          let elementname = basename(relativePath);
          let pathOnFileSystem = parentObject.getPath() + elementname;
          pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");
          let newObject = new DirectoryView(parentObject, {
            name: elementname,
            path: pathOnFileSystem,
            rights: dirinfo.rights
          });
          parentObject.entries.append(newObject);
          if (parentObject.isExpanded) {
            parentObject.refresh(parentObject)
            parentObject.deselect();
            parentObject.select(newObject);
          }
        }

        // Remove old object
        if (oldObject) oldObject.remove()
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  moveDirectory(initialPath, newDirectoryPath) {
    const self = this;

    if (initialPath.trim() == newDirectoryPath.trim()) return;

    console.log(initialPath, newDirectoryPath);

    let src = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + initialPath)
      .replace(/\/+/g, "/");
    let dest = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + newDirectoryPath)
      .replace(/\/+/g, "/");

    // get info from old object
    let oldObject = self.getRoot().find(trailingslashit(initialPath + '/'));
    let dirinfo = {
      size: 0,
      rights: null
    };
    if (oldObject) {
      if (oldObject) {
        oldObject = oldObject.view();
      }
      dirinfo.rights = oldObject.rights;

      oldObject.label.addClass('icon-sync')
        .addClass('spin');
    }

    self.getRoot()
      .connector.rename(src.trim(), dest.trim())
      .then(() => {
        // Refresh cache
        self.getRoot().getFinderItemsCache().renameDirectory(initialPath, newDirectoryPath);

        // Add new object
        let elementname = basename(dest);
        let pathOnFileSystem = self.getPath() + elementname;
        pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");
        let newObject = new DirectoryView(self, {
          name: elementname,
          path: pathOnFileSystem,
          rights: dirinfo.rights
        });
        self.entries.append(newObject);
        if (self.isExpanded) {
          self.refresh(self)
          self.deselect();
          self.select(newObject);
        }

        // Remove old object
        if (oldObject) {
          oldObject.remove();
        }
      })
      .catch(function (err) {
        if (oldObject) {
          oldObject.label.removeClass('icon-sync')
            .removeClass('spin');
        }
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  copyDirectory(initialPath, newDirectoryPath) {
    const self = this;

    if (initialPath.trim() == newDirectoryPath.trim()) return;

    let src = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + initialPath)
      .replace(/\/+/g, "/");
    let dest = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + newDirectoryPath)
      .replace(/\/+/g, "/");

    // TODO
    console.log('copy', src, dest);
  }

  moveFile(initialPath, newDirectoryPath) {
    const self = this;

    if (initialPath.trim() == newDirectoryPath.trim()) return;

    let src = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + initialPath).replace(/\/+/g, "/");
    let dest = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + newDirectoryPath).replace(/\/+/g, "/");

    // get info from old object
    let oldObject = self.getRoot().find(trailingslashit(initialPath));
    let fileinfo = {
      size: 0,
      rights: null,
      content: "",
      exists: false
    };
    if (oldObject) {
      if (oldObject) {
        oldObject = oldObject.view();
      }
      fileinfo.size = oldObject.size;
      fileinfo.rights = oldObject.rights;
    }

    self.getRoot()
      .connector.existsFile(dest.trim())
      .then((result) => {
        return new Promise((resolve, reject) => {
          atom.confirm({
            message: 'File already exists. Are you sure you want to overwrite this file?',
            detailedMessage: "You are overwrite:\n" + newDirectoryPath.trim(),
            buttons: {
              Yes: () => {
                fileinfo.exists = true;

                self.getRoot()
                  .connector.deleteFile(dest.trim())
                  .then(() => {
                    reject(true);
                  })
                  .catch((err) => {
                    self.getRoot()
                      .connector.showMessage(err.message, 'error');
                    resolve(false);
                  });
              },
              Cancel: () => {
                resolve(false);
              }
            }
          });
        });
      })
      .catch(() => {

        // add sync icon
        if (oldObject) {
          oldObject.label.addClass('icon-sync').addClass('spin');
        }

        self.getRoot()
          .connector.rename(src.trim(), dest.trim())
          .then(() => {
            // Refresh cache
            self.getRoot().getFinderItemsCache().renameFile(src.replace(self.getRoot().config.remote, ''), dest.replace(self.getRoot().config.remote, ''), fileinfo.size);

            // Add new object
            let elementname = basename(dest);
            let pathOnFileSystem = self.getPath() + elementname;
            pathOnFileSystem = pathOnFileSystem.replace(/\/+/g, "/");
            let newObject = new FileView(self, {
              name: elementname,
              path: pathOnFileSystem,
              size: fileinfo.size,
              rights: fileinfo.rights
            });

            if (!fileinfo.exists) {
              self.entries.append(newObject);
              if (self.isExpanded) {
                self.refresh(self)
                self.deselect();
                self.select(newObject);
              }
            }

            // Check if file is already opened
            let found = null;
            texteditors = atom.workspace.getTextEditors();
            texteditors.forEach((texteditor) => {
              if (texteditor.getPath() == oldObject.getLocalPath(true) + oldObject.name) {
                found = texteditor;
                return false;
              }
            });

            if (found) {
              found.saveObject = newObject;
              found.saveAs(newObject.getLocalPath(true) + newObject.name);
            }

            // Move local file
            let initialPath = oldObject.getLocalPath(true) + oldObject.name;
            let arrPath = newObject.getLocalPath().split(Path.sep);
            arrPath.pop();
            let newDirectoryPath = arrPath.join(Path.sep);
            let newPath = newObject.getLocalPath(true) + newObject.name;

            try {
              if (!FileSystem.existsSync(newDirectoryPath)) {
                FileSystem.makeTreeSync(newDirectoryPath);
              }
              if (FileSystem.existsSync(newPath)) {
                FileSystem.removeSync(newPath);
              }
              FileSystem.moveSync(initialPath, newPath);
            } catch (_error) {}

            // Remove old object
            if (oldObject) {
              oldObject.remove();
            }
          })
          .catch(function (err) {
            if (oldObject) {
              oldObject.label.removeClass('icon-sync').removeClass('spin');
            }
            self.getRoot().connector.showMessage(err.message, 'error');
          });
      });
  }

  copyFile(initialPath, newDirectoryPath) {
    const self = this;

    // Rename file if exists
    if (initialPath.trim() == newDirectoryPath.trim()) {

      let filePath;
      let fileCounter = 0;
      let originalNewPath = newDirectoryPath.trim();
      let parentPath = dirname((((self.config.remote) ? '/' + self.config.remote + '/' : '/') + newDirectoryPath)
        .replace(/\/+/g, "/"));

      self.getRoot()
        .connector.listDirectory(parentPath)
        .then((list) => {

          let files = [];
          let fileList = list.filter((item) => {
            return item.type === '-';
          });

          fileList.forEach(function (element) {
            files.push(element.name);
          });

          // append a number to the file if an item with the same name exists
          let extension = getFullExtension(originalNewPath);
          while (files.includes(Path.basename(newDirectoryPath))) {
            extension = getFullExtension(originalNewPath);
            filePath = dirname(originalNewPath) + Path.basename(originalNewPath, extension);
            newDirectoryPath = filePath + fileCounter + extension;
            fileCounter += 1;
          }
          self.copyFile(initialPath, newDirectoryPath);
        })
        .catch((err) => {
          self.getRoot()
            .connector.showMessage(err.message, 'error');
        });
      return;
    }

    let src = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + initialPath).replace(/\/+/g, "/");
    let dest = (((self.config.remote) ? '/' + self.config.remote + '/' : '/') + newDirectoryPath).replace(/\/+/g, "/");

    let srcLocalPath = (self.getRoot().getLocalPath(true) + initialPath.replace(/^\//, "")
      .replace(/\/+/g, Path.sep)).replace(/\/+/g, Path.sep);
    let destLocalPath = (self.getRoot().getLocalPath(true) + newDirectoryPath.replace(/^\//, "")
      .replace(/\/+/g, Path.sep)).replace(/\/+/g, Path.sep);

    let fileinfo = {
      size: 0,
      rights: null,
      content: "",
      exists: false
    };

    // Create local Directories
    createLocalPath(srcLocalPath);
    createLocalPath(destLocalPath);

    self.getRoot()
      .connector.existsFile(dest.trim())
      .then((result) => {
        return new Promise((resolve, reject) => {
          atom.confirm({
            message: 'File already exists. Are you sure you want to overwrite this file?',
            detailedMessage: "You are overwrite:\n" + newDirectoryPath.trim(),
            buttons: {
              Yes: () => {
                fileinfo.exists = true;
                reject(true);
              },
              Cancel: () => {
                resolve(false);
              }
            }
          });
        });
      })
      .catch(() => {

        // Add to Download Queue
        let download_queueItem = Queue.addFile({
          direction: "download",
          remotePath: src,
          localPath: srcLocalPath,
          size: 0
        });

        return self.getRoot()
          .connector.downloadFile(download_queueItem)
          .then(() => {

            // Get filesize
            FileSystem.stat(srcLocalPath, function (err, stats) {
              if (stats) {
                fileinfo.size = stats.size;

                // Add to Upload Queue
                let upload_queueItem = Queue.addFile({
                  direction: "upload",
                  remotePath: dest,
                  localPath: destLocalPath,
                  size: fileinfo.size
                });

                // create local file
                try {
                  FileSystem.createReadStream(srcLocalPath).pipe(FileSystem.createWriteStream(destLocalPath));
                } catch (err) { console.log(srcLocalPath, destLocalPath, err); }

                return self.getRoot()
                  .connector.uploadFile(upload_queueItem)
                  .then(() => {
                    // Refresh cache
                    self.getRoot().getFinderItemsCache().addFile(dest.replace(self.getRoot().config.remote, ''), self.size);

                    if (!fileinfo.exists) {
                      // Add new object
                      let elementname = basename(dest);
                      let newObject = new FileView(self, {
                        name: elementname,
                        path: destLocalPath,
                        size: fileinfo.size,
                        rights: fileinfo.rights
                      });
                      self.entries.append(newObject);
                      if (self.isExpanded) {
                        self.refresh(self)
                        self.deselect();
                        self.select(newObject);
                      }
                    }
                  })
                  .catch(function (err) {
                    upload_queueItem.changeStatus('Error');
                    self.getRoot()
                      .connector.showMessage(err.message, 'error');
                  });
              } else if (err) {
                self.getRoot()
                  .connector.showMessage(err.message, 'error');
              }
            });
          })
          .catch(function (err) {
            download_queueItem.changeStatus('Error');
            self.getRoot()
              .connector.showMessage(err.message, 'error');
          });
      });
  }

  upload(initialPath, newDirectoryPath) {
    const self = this;

    // TODO
    console.log('upload', initialPath, newDirectoryPath);
  }

  deleteDirectory(recursive) {
    const self = this;
    self.getRoot()
      .connector.deleteDirectory(self.getPath(), recursive)
      .then(() => {
        // Refresh cache
        self.getRoot().getFinderItemsCache().deleteDirectory(self.getPath(false));

        let fullLocalPath = (self.getLocalPath(true)).replace(/\/+/g, Path.sep);

        // Delete local directory
        deleteLocalPath(fullLocalPath);
        
        self.destroy();
      })
      .catch(function (err) {
        self.getRoot()
          .connector.showMessage(err.message, 'error');
      });
  }

  chmodDirectory(permissions) {
    const self = this;

    self.getRoot().connector.chmodDirectory(self.getPath(true), permissions).then((responseText) => {
      self.rights = permissionsToRights(permissions);
    }).catch(function (err) {
      self.getRoot().connector.showMessage(err.message, 'error');
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
