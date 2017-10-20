'use babel';

import { isPathIgnored } from './helper.js';
import { basename, dirname } from './format.js';

const EventEmitter = require('events');
const tempDirectory = require('os').tmpdir();
const shortHash = require('short-hash');
const Path = require('path');
const FileSystem = require('fs-plus');

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

    if (self.loadCache()) {
      self.emit('finder-items-cache-queue:finish', self.items);
      return true;
    }

    self.list([{
      path: self.config.remote + '/',
      relativePath: '/'
    }]).then((list) => {
      self.storeCache();
      self.emit('finder-items-cache-queue:finish', self.items);
      console.log('finder-items-cache-queue:finish');
    }).catch(function (err) {
      self.loadTask = false;
      self.emit('finder-items-cache-queue:error', err);
      console.log('finder-items-cache-queue:error', err);
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
          if (element.type == 'd' && !isPathIgnored(element.name)) {
            remotePaths.push({ path: path + element.name + '/', relativePath: relativePath + element.name + '/' });
          } else if (element.type === '-' && !isPathIgnored(element.name)) {
            self.items.push({ file: element.name, relativePath: relativePath + element.name, size: element.size });
          }
        });
        self.emit('finder-items-cache-queue:index', self.items);

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

  storeCache() {
    const self = this;

    let path = ((self.config.remote) ? tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/' + self.config.remote + '/' :
        tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/')
      .replace(/\/+/g, Path.sep);
    let file = path + Path.sep + '.cache';

    try {
      FileSystem.writeFileSync(file, JSON.stringify(self.items));
    } catch (ex) {}
  }

  loadCache() {
    const self = this;

    let path = ((self.config.remote) ? tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/' + self.config.remote + '/' :
        tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/')
      .replace(/\/+/g, Path.sep);
    let file = path + Path.sep + '.cache';

    try {
      if (FileSystem.existsSync(file)) {
        let cache = FileSystem.readFileSync(file);
        self.items = JSON.parse(cache);
        return true;
      }
    } catch (ex) {}
    return false;
  }

  getItems() {
    const self = this;

    return self.items;
  }

  addItem(relativePath, size = 0) {
    const self = this;

    if (!self.items) return;

    relativePath = relativePath.replace(/^\//, '');
    let file = basename(relativePath);
    self.items.push({ file: file, relativePath, size });
    self.storeCache();
    self.emit('finder-items-cache-queue:update', self.items);
  }

  deleteItem(relativePath) {
    const self = this;

    if (!self.items) return;

    self.items = self.items.filter((item) => {
      return item.relativePath != relativePath;
    });
    self.storeCache();
    self.emit('finder-items-cache-queue:update', self.items);
  }

}

module.exports = FinderItemsCache;
