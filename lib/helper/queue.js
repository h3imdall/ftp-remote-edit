'use babel';

import ProtocolItemView from './../views/protocol-item-view.js';

class Queue {

  constructor() {
    const self = this;

    self.onDidAddFile = () => {};
    self.onDidRemoveFile = () => {};

    self.list = [];
  }

  destroy() {
    const self = this;

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

    self.list.push(item);
    
    self.onDidAddFile(item);

    return item;
  }

  removeFile(file) {
    const self = this;

    self.list = self.list.filter((item) => {
      return item != file;
    });

    self.onDidRemoveFile(file);
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
