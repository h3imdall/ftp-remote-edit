'use babel';

import { $, ScrollView } from 'atom-space-pen-views';
import { decrypt, encrypt, checkPassword, setPassword } from './../helper/secure.js';
import { cleanJsonString } from './../helper/format.js';

const FTP_REMOTE_EDIT_PROTOCOL_URI = 'h3imdall://ftp-remote-edit-protocol';

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

    self.head.prepend(`<tr><th>Server/Local file</th><th>Direction</th><th>Remote file</th><th>Size</th><th>Status</th></tr>`);

    self.queue = [];

    atom.workspace.addOpener(uri => {
      if (uri === FTP_REMOTE_EDIT_PROTOCOL_URI) {
        return self;
      }
    });
    atom.workspace.open(FTP_REMOTE_EDIT_PROTOCOL_URI, { activatePane: false, activateItem: false });
  };

  destroy() {
    const self = this;

    self.queue = [];
    self.remove();
  };

  toggle() {
    atom.workspace.toggle(this);
  };
}

module.exports = ProtocolView;
