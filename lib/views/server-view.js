'use babel';

import Ftp from './../connectors/ftp.js';
import Sftp from './../connectors/sftp.js';
import DirectoryView from './directory-view.js';

class ServerView extends DirectoryView {
  
  ServerView() {
    super.ServerView();

    const self = this;

    self.parent = null;
    self.config = null;
    self.name = '';
    self.isExpanded = false;
  }

  static content() {
    return this.li({
      class: 'server directory entry list-nested-item project-root collapsed',
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

  initialize(config) {
    const self = this;

    self.parent = null;
    self.config = config;
    self.name = self.config.name ? self.config.name : self.config.host;
    self.isExpanded = false;

    self.label.text(self.name);
    self.label.addClass('icon-file-symlink-directory');
    self.addClass('project-root');

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
      self.toggle();
    });
  };
}

module.exports = ServerView;
