'use babel';

import Connector from './../connectors/connector.js';
import DirectoryView from './directory-view.js';

class ServerView extends DirectoryView {

  ServerView() {
    super.ServerView();

    const self = this;

    self.parent = null;
    self.config = null;
    self.name = '';
    self.isExpanded = false;
    self.debug = false;
  }

  static content() {
    return this.li({
      class: 'server entry list-nested-item project-root collapsed',
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
  };

  initialize(config, treeView) {
    const self = this;

    self.treeView = treeView
    self.parent = null;
    self.config = config;
    self.name = self.config.name ? self.config.name : self.config.host;
    self.isExpanded = false;

    if (atom.config.get('ftp-remote-edit.debug')) {
      self.debug = atom.config.get('ftp-remote-edit.debug');
    } else {
      self.debug = false;
    }

    self.label.text(self.name);
    self.label.addClass('icon-file-symlink-directory');
    self.addClass('project-root');

    self.attr('data-host', self.config.host);

    self.connector = null;
    self.connector = new Connector(self.config);

    // Events
    self.connector.on('log', function (msg) {
      self.treeView.trigger('log', msg);
    });
    self.connector.on('debug', function (cmd, param1, param2) {
      if (self.debug) {
        if (param1 && param2) console.log(cmd, param1, param2);
        if (param1) console.log(cmd, param1);
        if (cmd) console.log(cmd);
      }
    });
    self.on('click', function (e) {
      e.stopPropagation();
      self.toggle();
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();
      self.toggle();
    });
  };

  collapse() {
    const self = this;

    self.connector.destroy();
    self.isExpanded = false;
    self.setClasses();
    self.entries.children()
      .detach();
    self.label.removeClass('icon-sync')
      .removeClass('spin')
      .addClass('icon-file-directory');
  };
}

module.exports = ServerView;
