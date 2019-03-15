'use babel';

import { $, View } from 'atom-space-pen-views';
import ServerView from './server-view.js';
import { showMessage } from './../helper/helper.js';

class FolderView extends View {

  static content() {
    return this.li({
      class: 'folder entry list-nested-item project-root collapsed',
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

  initialize(config, parent) {
    const self = this;

    self.onDidAddServer = (server) => { }
    self.onDidAddFolder = (folder) => { }

    self.config = config;
    self.parent = parent;
    self.expanded = false;

    self.name = self.config.name;
    self.children = self.config.children;
    self.id = self.config.id;

    self.label.text(self.name);
    self.label.addClass('icon-file-submodule');


    self.attr('id', self.id);

    // Events
    self.on('click', (e) => {
      e.stopPropagation();
      self.toggle();
    });
    self.on('dblclick', (e) => { e.stopPropagation(); });

    // Drag & Drop
    self.on('dragstart', (e) => { e.stopPropagation(); return false; });
    self.on('dragenter', (e) => { e.stopPropagation(); return false; });
    self.on('dragleave', (e) => { e.stopPropagation(); return false; });

  }

  destroy() {
    const self = this;

    this.remove();
  }

  getRoot() {
    const self = this;

    return self.parent.getRoot();
  }

  expand() {
    const self = this;

    self.expanded = true;
    self.addClass('expanded').removeClass('collapsed');

    self.entries.children().detach();

    self.children.forEach((config) => {
      if (typeof config.children !== 'undefined') {
        self.addFolder(config);
      } else {
        self.addServer(config);
      }
    });

  }

  isExpanded() {
    const self = this;

    return self.expanded;

  }

  addServer(config) {
    const self = this;

    let server = new ServerView(config);

    self.onDidAddServer(server);

    self.entries.append(server);
  }

  addFolder(config) {
    const self = this;

    let folder = new FolderView(config, self);

    folder.onDidAddServer = (server) => {
      self.onDidAddServer(server);
    };
    self.onDidAddFolder(folder);

    self.entries.append(folder);
  }

  collapse() {
    const self = this;

    self.expanded = false;
    self.addClass('collapsed').removeClass('expanded');

    if (self.entries.children().length > 0) {
      const childNodes = Array.from(self.entries.children());
      childNodes.forEach((childNode) => {
        const child = $(childNode).view();
        if (child.isExpanded()) {
          child.collapse();
        }
      });
    }
  }

  toggle() {
    const self = this;

    if (self.expanded) {
      self.collapse();
    } else {
      self.expand();
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

}

module.exports = FolderView;
