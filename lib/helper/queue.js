'use babel';

import ProtocolItemView from './../views/protocol-item-view.js';
import { CompositeDisposable, Disposable } from 'atom';

const FileSystem = require('fs-plus');
const EventEmitter = require('events');
const tempDirectory = require('os').tmpdir();

class Queue extends EventEmitter {
  constructor() {
    super();
    const self = this;

    self.list = [];

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    self.listeners = new CompositeDisposable();
  }

  destroy() {
    const self = this;

    self.listeners.dispose();
    self.treeView.destroy();
  }

  onFileError() {
    const self = this;

    self.emit('protocol-queue:error');
  };

  onFileTransferring() {
    // TODO
  };

  onFileFinished() {
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

    // Register command
    self.listeners.add(atom.commands.add(item, {
      'protocol-queue-view:error': () => self.onFileError(),
      'protocol-queue-view:transferring': () => self.onFileTransferring(),
      'protocol-queue-view:finished': () => self.onFileFinished(),
    }));

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
