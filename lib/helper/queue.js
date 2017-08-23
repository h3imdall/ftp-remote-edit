'use babel';

import ProtocolItemView from './../views/protocol-item-view.js';

const FileSystem = require('fs-plus');
const EventEmitter = require('events');
const tempDirectory = require('os')
  .tmpdir();

class Queue extends EventEmitter {
  constructor() {
    super();
    const self = this;

    self.setMaxListeners(100);
    self.list = [];
  }

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

    item.on('protocol-queue-view:error', (event) => {
      self.emit('protocol-queue:error', event);
    });

    self.emit('protocol-queue:add', item);

    return item;
  }

  removeFile(file) {
    const self = this;

    self.emit('protocol-queue:remove', file);
  }
}
module.exports = new Queue;
