'use babel';

import ProtocolItemView from './../views/protocol-item-view.js';

const FileSystem = require('fs-plus');
const EventEmitter = require('events');
const tempDirectory = require('os').tmpdir();

class Queue extends EventEmitter {
  constructor() {
    super();
    const self = this;

    self.setMaxListeners(0);
    self.list = [];
  }

  onFileError(file) {
    const self = this;

    self.emit('protocol-queue:error');
  };

  onFileTransferring(file) {
    // TODO
  };

  onFileFinished(file) {
    // TODO
  };

  addFile(file) {
    const self = this;

    let item = new ProtocolItemView({
      client: file.client,
      direction: file.direction,
      remotePath: file.remotePath,
      localPath: file.localPath,
      size: file.size,
      stream: file.stream
    });

    item.on('protocol-queue-view:error', () => { self.onFileError(item) });
    item.on('protocol-queue-view:transferring', () => { onFileTransferring(item) });
    item.on('protocol-queue-view:finished', () => { onFileFinished(item) });

    self.list.push(item);
    self.emit('protocol-queue:add', item);

    return item;
  }

  removeFile(file) {
    const self = this;

    self.emit('protocol-queue:remove', file);
  }

  existsFile(path) {
    const self = this;

    if (self.list.length == 0) return false;

    let items = self.list.filter((item) => {
      return item.info.localPath === path && (item.info.status == 'Waiting' || item.info.status == 'Transferring');
    });

    return (items.length > 0) ? true : false;
  }
}
module.exports = new Queue;
