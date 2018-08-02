'use babel';

import { $, ScrollView } from 'atom-space-pen-views';
import { decrypt, encrypt, checkPassword, setPassword } from './../helper/secure.js';
import { cleanJsonString } from './../helper/format.js';

const FTP_REMOTE_EDIT_PROTOCOL_URI = 'h3imdall://ftp-remote-edit-protocol';
const Queue = require('./../helper/queue.js');

class ProtocolView extends ScrollView {

  static content() {
    return this.div({
      class: 'ftp-remote-edit-protocol tool-panel',
    }, () => {
      this.table({
        class: 'ftp-remote-edit-protocol-table',
        tabindex: -1,
        outlet: 'table',
      }, () => {
        this.thead({
          outlet: 'head',
        });
        this.tbody({
          outlet: 'list',
        });
      });

    });
  };

  getTitle() {
    return "Ftp-Remote-Edit";
  }

  getURI() {
    return FTP_REMOTE_EDIT_PROTOCOL_URI;
  }

  getAllowedLocations() {
    return ["bottom"];
  }

  getDefaultLocation() {
    return "bottom";
  }

  initialize(state) {
    super.initialize(state)

    const self = this;

    atom.workspace.addOpener(uri => {
      if (uri === FTP_REMOTE_EDIT_PROTOCOL_URI) {
        return self;
      }
    });
    atom.workspace.open(FTP_REMOTE_EDIT_PROTOCOL_URI, { activatePane: false, activateItem: false });

    self.head.prepend(`<tr><th>Local file</th><th>Direction</th><th>Remote file</th><th>Size</th><th>Progress</th><th>Status</th></tr>`);

    try {
      Queue.on('protocol-queue:add', (queueView) => {
        self.list.prepend(queueView);
        const children = self.list.children();
        if (children.length > 20) {
          children.last().remove();
        }
      });

      Queue.on('protocol-queue:error', (error) => {
        if (atom.config.get('ftp-remote-edit.notifications.openProtocolViewOnError')) {
          atom.workspace.open(FTP_REMOTE_EDIT_PROTOCOL_URI);
        }
      });
    } catch (e) { console.log(e); }
  };

  destroy() {
    const self = this;

    self.remove();
  };

  toggle() {
    atom.workspace.toggle(this);
  };
}

module.exports = ProtocolView;
