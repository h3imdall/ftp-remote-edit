'use babel';

import { $, View } from 'atom-space-pen-views';
import ServerView from './server-view.js';
import { showMessage } from './../helper/helper.js';
import FtpLogView from './ftp-log-view.js';

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

  initialize(config) {
    const self = this;

    self.config = config;
    self.isExpanded = false;

    self.name = self.config.name;
    self.childrens = self.config.childrens;
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

  }

  destroy() {
    const self = this;

    this.remove();
  }

  getRoot() {
    const self = this;

    return self;
  }

  expand() {
    const self = this;

    self.isExpanded = true;
    self.addClass('expanded').removeClass('collapsed');

    self.entries.children().detach();

    self.childrens.forEach((config) => {
        if(typeof config.childrens !== 'undefined') {
            self.addFolder(config);
        } else {
            self.addServer(config);
        }
    });

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

      self.entries.append(server);
  }

  addFolder(config) {
      const self = this;

      let folder = new FolderView(config);

      self.entries.append(folder);
  }

  collapse() {
    const self = this;

    self.isExpanded = false;
    self.addClass('collapsed').removeClass('expanded');
  }

  toggle() {
    const self = this;

    if (self.isExpanded) {
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
