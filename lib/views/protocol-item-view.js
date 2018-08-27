'use babel';

import { $, ScrollView } from 'atom-space-pen-views';
import { formatNumber } from './../helper/format.js';

class ProtocolItemView extends ScrollView {

  constructor(fileinfo) {
    super(fileinfo);
    const self = this;
  }
  static content() {
    return this.tr({
      class: 'ftp-remote-edit-protocol-item',
    }, () => {
      this.td({
        outlet: 'filename_a',
      });
      this.td({
        outlet: 'direction',
      });
      this.td({
        outlet: 'filename_b',
      });
      this.td({
        outlet: 'size',
      });
      this.td({
        outlet: 'progress',
      });
      this.td({
        outlet: 'status',
      });
    });
  };

  initialize(fileinfo) {
    super.initialize();
    const self = this;

    self.info = {
      client: fileinfo.client,
      direction: fileinfo.direction,
      remotePath: fileinfo.remotePath,
      localPath: fileinfo.localPath,
      size: (fileinfo.size) ? fileinfo.size : 0,
      progress: 0,
      stream: (fileinfo.stream) ? fileinfo.stream : null,
      status: (fileinfo.status) ? fileinfo.status : "Waiting"
    };

    if (self.info.direction == "download") {
      self.filename_a.html(self.info.localPath);
      self.filename_b.html(self.info.remotePath);
      self.direction.html("<--");
      self.size.html(formatNumber(self.info.size));
      self.status.html(self.info.status);
    } else {
      self.filename_a.html(self.info.localPath);
      self.filename_b.html(self.info.remotePath);
      self.direction.html("-->");
      self.size.html(formatNumber(self.info.size));
      self.status.html(self.info.status);
    }
  }

  destroy() {
    const self = this;

    self.remove();
  };

  addStream(stream) {
    const self = this;

    self.info.stream = stream;
  }

  changeProgress(data) {
    const self = this;

    self.info.progress = data;
    let percent = (self.info.size) ? (100 / self.info.size * self.info.progress)
      .toFixed(1) : 0;
    self.progress.html(formatNumber(self.info.progress) + ' (' + percent + ' %)');
    if (self.info.size > 0 && self.info.size == self.info.progress) {
      self.changeStatus('Finished');
    }
  }

  changeStatus(status) {
    const self = this;
    
    let oldStatus = self.info.status;
    if (status.toLowerCase() == "connection closed" && self.info.status == "Transferring") {
      atom.commands.dispatch(self, 'protocol-queue-view:error');
      self.info.status = 'Error';
      self.status.html('Error');
    } else if (status.toLowerCase() == "connection closed") {
      // Do nothing
    } else if (status.toLowerCase() == "error") {
      atom.commands.dispatch(self, 'protocol-queue-view:error');
      self.info.status = status;
      self.status.html(self.info.status);
    } else if (status.toLowerCase() == "transferring" && self.info.status != "Waiting") {
      // Do nothing
    } else {
      // atom.commands.dispatch(self, 'protocol-queue-view:' + status.toLowerCase());
      self.info.status = status;
      self.status.html(self.info.status);
    }
  }
}

module.exports = ProtocolItemView;
