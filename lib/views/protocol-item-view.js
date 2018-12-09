'use babel';

import { View } from 'atom-space-pen-views';
import { formatNumber } from './../helper/format.js';

class ProtocolItemView extends View {

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
  }

  initialize(fileinfo) {
    const self = this;

    self.onError = () => {};
    self.onTransferring = () => {};
    self.onFinished = () => {};

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
  }

  addStream(stream) {
    const self = this;

    self.info.stream = stream;
  }

  changeProgress(data) {
    const self = this;

    self.info.progress = data;
    const percent = (self.info.size) ? (100 / self.info.size * self.info.progress).toFixed(1) : 0;
    self.progress.html(formatNumber(self.info.progress) + ' (' + percent + ' %)');
  }

  changeStatus(status) {
    const self = this;

    if (status.toLowerCase() == "connection closed" && self.info.status == "Transferring") {
      self.onError();
      self.info.status = 'Error';
      self.status.html('Error');
    } else if (status.toLowerCase() == "connection closed") {
      // Do nothing
    } else if (status.toLowerCase() == "error") {
      self.onError();
      self.info.status = status;
      self.status.html(self.info.status);
    } else if (status.toLowerCase() == "transferring" && self.info.status != "Waiting") {
      // Do nothing
    } else {
      if (status.toLowerCase() == "transferring") {
        self.onTransferring();
      } else if (status.toLowerCase() == "finished") {
        self.onFinished();
      }
      self.info.status = status;
      self.status.html(self.info.status);
    }
  }
}

module.exports = ProtocolItemView;
