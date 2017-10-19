'use babel';

import { isPathIgnored } from './helper.js';
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
    self.loadTask = true;

    self.list([{
      path: self.config.remote + '/',
      relativePath: '/'
    }]).then((list) => {
      self.emit('finder-items-cache-queue:finish');
      console.log('finder-items-cache-queue:finish');
    }).catch(function (err) {
      self.loadTask = false;
      self.emit('finder-items-cache-queue:error', err);
      console.log('finder-items-cache-queue:error',err);
    });
  }

  list(remotePaths) {
    const self = this;

    let tmp = remotePaths.shift();
    let path = tmp.path;
    let relativePath = tmp.relativePath;

    return self.connector.listDirectory(path)
      .then((list) => {
        list.forEach((element) => {
          if (element.type == 'd' && !isPathIgnored(path + element.name)) {
            remotePaths.push({ path: path + element.name + '/', relativePath: relativePath + element.name + '/' });
          } else if (element.type === '-' && !isPathIgnored(path + element.name)) {
            self.items.push({ relativePath: relativePath + element.name, size: element.size });
          }
        });
        self.emit('finder-items-cache-queue:update', self.items);

        if (remotePaths.length > 0) {
          return self.list(remotePaths)
            .then(() => {
              return new Promise((resolve, reject) => {
                resolve();
              });
            }).catch(function (err) {
              return new Promise((resolve, reject) => {
                reject(err);
              });
            });
        } else {
          return new Promise((resolve, reject) => {
            resolve();
          });
        }
      }).catch(function (err) {
        self.loadTask = false;
        return new Promise((resolve, reject) => {
          reject(err);
        });
      });
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
