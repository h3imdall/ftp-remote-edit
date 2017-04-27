'use babel';

import Ftp from './../connectors/ftp.js';
// import Sftp from './../connectors/sftp.js';
import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';
import FileView from './file-view.js';

var FileSystem = require('fs');
const tempDirectory = require('os').tmpdir();

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

    self.connector = null;
    if (self.config.sftp === true) {
      self.connector = new Sftp(self.config);
    } else {
      self.connector = new Ftp(self.config);
    }

    // Events
    self.on('click', function (e) {
      e.stopPropagation();
      self.toggle();
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();
    });
  };

  destroy() {
    this.remove();
  };

  getRoot() {
    const self = this;

    if (self.parent) {
      return self.parent;
    }
    return self;
  }

  getPath() {
    const self = this;

    if (self.parent) {
      return self.parent.getPath() + '/' + self.name;
    }
    return '';
  }

  getLocalPath() {
    const self = this;

    if (self.parent) {
      return self.parent.getLocalPath() + '/' + self.name;
    }
    return tempDirectory + '/' + self.config.host;
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
      let pathOnFileSystem = self.getPath() + '/' + element.name;
      pathOnFileSystem = pathOnFileSystem.replace('//', '/');

      let li = new DirectoryView(self, {
        name: element.name,
        path: pathOnFileSystem
      });
      entries.push(li);
    }, this);

    files.forEach(function (element) {
      let pathOnFileSystem = self.getPath() + '/' + element.name;
      pathOnFileSystem = pathOnFileSystem.replace('//', '/');

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

  expand(recursive) {
    const self = this;

    let promise = new Promise((resolve, reject) => {
      self.isExpanded = true;
      self.setClasses();
      self.label.addClass('icon-sync')
        .removeClass('icon-file-directory');

      self.connector.listDirectory(self.getPath())
        .then((list) => {
          self.paint(list);
          self.label.removeClass('icon-sync')
            .addClass('icon-file-directory');
          resolve(true);
        })
        .catch(function (err) {
          self.label.removeClass('icon-sync')
            .addClass('icon-file-directory');
          self.collapse();
          reject(err);
        });
    });

    return promise;
  };

  collapse(recursive) {
    const self = this;

    self.isExpanded = false;
    self.setClasses();
    self.entries.children()
      .detach();
    self.label.removeClass('icon-sync')
      .addClass('icon-file-directory');
  };

  toggle(recursive) {
    const self = this;

    if (self.isExpanded) {
      self.collapse(recursive);
    } else {
      self.expand(recursive);
    }
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

    self.connector.uploadFile('', relativePath.trim())
      .then(() => {
        self.collapse();
        self.expand()
          .then(() => {
            let find = self.find(relativePath);
            if (find) {
              self.deselect();
              find[0].classList.add('selected');
              find.view()
                .open();
            }
          });
      });
  }

  newDirectory(relativePath) {
    const self = this;

    self.connector.createDirectory(relativePath.trim())
      .then(() => {
        self.collapse();
        self.expand()
          .then(() => {
            let find = self.find(relativePath);
            if (find) {
              self.deselect();
              find[0].classList.add('selected');
            }
          });
      });
  }

  rename(relativePath) {
    const self = this;

    self.connector.rename(self.getPath(), relativePath.trim())
      .then(() => {
        let pathArr = relativePath.trim()
          .split('/');

        self.name = pathArr.pop();
        self.label.text(self.name);
        self.attr('data-name', self.name);
      });
  }

  delete(recursive) {
    const self = this;

    self.connector.deleteDirectory(self.getPath(), recursive)
      .then(() => {
        self.destroy();
      });
  }

  // addDragAndDrop () {
  //   this.directoryIconOpenClose.addEventListener('dragover', (event) => {
  //     // console.log(event);
  //     event.dataTransfer.dropEffect = "copy";
  //   });
  //
  //   this.element.addEventListener('drop', (event) => {
  //     event.preventDefault();
  //     console.log(event);
  //     this.element.classList.remove('drag');
  //   });
  //
  //   this.directoryIconOpenClose.addEventListener('dragenter', (event) => {
  //     event.preventDefault();
  //     this.element.classList.add('drag');
  //   });
  //
  //   this.directoryIconOpenClose.addEventListener('dragleave', (event) => {
  //     event.preventDefault();
  //     this.element.classList.remove('drag');
  //   });
  // }
}

module.exports = DirectoryView;
