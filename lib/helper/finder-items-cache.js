'use babel';

const EventEmitter = require('events');

class FinderItemsCache extends EventEmitter {

  constructor(config, connector) {
    super();
    const self = this;

    self.setMaxListeners(100);
    self.items = [];
    self.config = config;
    self.connector = connector;
    self.loadTask = false;
  }

  load() {
    const self = this;

    if (self.loadTask) return;

    let remotePath = self.config.remote + '/';
    self.connector.listDirectory(remotePath)
      .then((list) => {
        self.loadTask = true;

        list.forEach((element) => {
          if (element.type == 'd') {
            // dirDFS(filePaths, remotePath + element.name + '/', remotePath + element.name + '/');
          } else if (element.type === '-') {
            self.items.push({ relativePath: remotePath + element.name, size: element.size });
            self.emit('finder-items-cache-queue:update', self.items);
          }
        });
      }).catch(function (err) {
        self.loadTask = false;
        console.log(err);
      });

    // self.connector.listRemotePaths(self.config.remote + '/')
    //   .then((result) => {
    //     self.loadTask = true;
    //     self.items = result;
    //     self.emit('finder-items-cache-queue:load', self.items);
    //   })
    //   .catch((err) => {
    //     self.loadTask = false;
    //     console.log(err);
    //   });
  }

  getItems() {
    const self = this;

    return self.items;
  }

  addItem(relativePath, size = 0) {
    const self = this;

    if (!self.items) return;

    relativePath = relativePath.replace(/^\//, '');
    self.items.push({ relativePath, size });
    self.emit('finder-items-cache-queue:update', self.items);
  }

  deleteItem(relativePath) {
    const self = this;

    if (!self.items) return;

    self.items = self.items.filter((item) => {
      return item.relativePath != relativePath;
    });
    self.emit('finder-items-cache-queue:update', self.items);
  }

}

module.exports = FinderItemsCache;
