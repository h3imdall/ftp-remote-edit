'use babel';

import Ftp from './../connectors/ftp.js';
// import Sftp from './../connectors/sftp.js';
import { $ } from 'atom-space-pen-views';
import { View } from 'atom-space-pen-views';
import FileView from './file-view.js';

class DirectoryView extends View {
  DirectoryView() {
    super.DirectoryView();

    const self = this;
    self.parent = null;
    self.config = null;
    self.name = '';
    self.path = '';
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

    self.parent = parent;
    self.config = parent.config;
    self.name = directory.name;
    self.path = directory.path;
    self.isExpanded = false;

    self.label.text(self.name);
    self.label.addClass('icon-file-directory');

    self.attr('data-host', self.config.host);
    self.attr('data-path', self.path);

    self.connector = null;
    if (self.config.sftp === true) {
      self.connector = new Sftp(self.config);
    } else {
      self.connector = new Ftp(self.config);
    }

    // Events
    self.on('click', function (e) {
      e.stopPropagation();

      self.deselect();
      self.toggleClass('selected');
      self.toggle();
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();
    });

    self.on('contextmenu', function (e) {
      self.deselect();
      self.toggleClass('selected');
    });
  };

  repaint(list) {
    const self = this;

    self.entries.children().detach();

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
      let pathOnFileSystem = self.path + '/' + element.name;
      pathOnFileSystem = pathOnFileSystem.replace('//', '/');

      let li = new DirectoryView(self, {
        name: element.name,
        path: pathOnFileSystem
      });
      self.entries.append(li);

    }, this);

    files.forEach(function (element) {

      let pathOnFileSystem = self.path + '/' + element.name;
      pathOnFileSystem = pathOnFileSystem.replace('//', '/');

      let li = new FileView(self, {
        name: element.name,
        path: pathOnFileSystem
      });
      self.entries.append(li);

    }, this);
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

    self.isExpanded = true;
    self.setClasses();
    self.label.addClass('icon-sync').removeClass('icon-file-directory');
    self.connector.loadDirectory(self.path)
      .then((list) => {
        self.repaint(list);
        self.label.removeClass('icon-sync').addClass('icon-file-directory');
      });
  };

  collapse(recursive) {
    const self = this;

    self.isExpanded = false;
    self.setClasses();
    self.entries.children().detach();
    self.label.removeClass('icon-sync').addClass('icon-file-directory');
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
    var i, len, selected;
    if (elementsToDeselect == null) {
      elementsToDeselect = $('.ftp-remote-edit-view .selected');
    }
    for (i = 0, len = elementsToDeselect.length; i < len; i++) {
      selected = elementsToDeselect[i];
      selected.classList.remove('selected');
    }
    return void 0;
  };

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
