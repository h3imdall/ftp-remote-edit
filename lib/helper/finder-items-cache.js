'use babel';

import { isFinderPathIgnored } from './helper.js';
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

    self.items = [];
    self.paths = [];
    self.config = config;
    self.connector = connector;
    self.loadTask = false;
  }

  load(reindex = false) {
    const self = this;

    if (reindex) {
      self.loadTask = false;
      self.items = [];
      self.paths = [];
    }

    if (self.loadTask) return;

    if (reindex) {
      self.deleteCache();
    } else if (self.loadCache()) {
      if (self.paths.length > 0) {
        self.emit('finder-items-cache-queue:update', self.items);
      } else {
        self.emit('finder-items-cache-queue:finish', self.items);
        return true;
      }
    }

    if (self.paths.length == 0) {
      self.paths.push({
        path: self.config.remote + '/',
        relativePath: '/'
      });
    }

    self.loadTask = true;
    self.list(self.paths).then((list) => {
      self.storeCache(true);
      self.loadTask = false;
      self.emit('finder-items-cache-queue:finish', self.items);
    }).catch((err) => {
      self.storeCache(true);
      self.loadTask = false;
      self.emit('finder-items-cache-queue:error', err);
    });
  }

  list() {
    const self = this;

    let tmp = self.paths.shift();
    let path = tmp.path;
    let relativePath = tmp.relativePath;

    if (!self.loadTask) {
      return new Promise((resolve, reject) => {
        resolve();
      });
    }

    return self.connector.listDirectory(path).then((list) => {
      list.forEach((element) => {
        if (element.type == 'd' && !isFinderPathIgnored(element.name)) {
          self.paths.push({ path: path + element.name + '/', relativePath: relativePath + element.name + '/' });
        } else if (element.type === '-' && !isFinderPathIgnored(element.name)) {
          self.items.push({ file: element.name, directory: relativePath, relativePath: relativePath + element.name, size: element.size });
        }
      });
      self.emit('finder-items-cache-queue:index', self.items);

      if (self.paths.length > 0) {
        return self.list().then(() => {
          return new Promise((resolve, reject) => {
            resolve();
          });
        }).catch((err) => {
          return new Promise((resolve, reject) => {
            reject(err);
          });
        });
      } else {
        return new Promise((resolve, reject) => {
          resolve();
        });
      }
    }).catch((err) => {
      self.loadTask = false;
      return new Promise((resolve, reject) => {
        reject(err);
      });
    });
  }

  storeCache(createFile = false) {
    const self = this;

    let path = ((self.config.remote) ?
      tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/' + self.config.remote + '/' :
      tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/').replace(/\/+/g, Path.sep);
    let file = path + Path.sep + '.cache';

    if (!createFile && !FileSystem.existsSync(file)) return;

    let cache = {
      paths: self.paths,
      items: self.items,
    }
    try {
      FileSystem.writeFileSync(file, JSON.stringify(cache));
    } catch (ex) {}
  }

  loadCache() {
    const self = this;

    if (self.loadTask) return true;

    let path = ((self.config.remote) ?
      tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/' + self.config.remote + '/' :
      tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/').replace(/\/+/g, Path.sep);
    let file = path + Path.sep + '.cache';

    try {
      if (FileSystem.existsSync(file)) {
        let tmp = FileSystem.readFileSync(file);
        let cache = JSON.parse(tmp);
        self.paths = cache.paths;
        self.items = cache.items;
        return true;
      }
    } catch (ex) {}
    return false;
  }

  deleteCache() {
    const self = this;

    let path = ((self.config.remote) ?
      tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/' + self.config.remote + '/' :
      tempDirectory + '/' + shortHash(self.config.host + self.config.name) + '/' + self.config.host + '/').replace(/\/+/g, Path.sep);
    let file = path + Path.sep + '.cache';

    try {
      if (FileSystem.existsSync(file)) {
        FileSystem.unlinkSync(file);
        self.paths = [];
        self.items = [];
        return true;
      }
    } catch (ex) {
      self.paths = [];
      self.items = [];
    }

    return false;
  }

  addFile(relativePath, size = 0) {
    const self = this;

    if (!self.items) return;
    if (!self.loadTask && !self.loadCache()) return;

    let file = basename(relativePath);
    self.items.push({ file: file, directory: dirname(relativePath), relativePath: relativePath, size: size });
    self.storeCache();
    self.emit('finder-items-cache-queue:update', self.items);
  }

  renameFile(oldRelativePath, newRelativePath, size = 0) {
    const self = this;

    if (!self.items) return;
    if (!self.loadTask && !self.loadCache()) return;

    // Remove old
    self.items = self.items.filter((item) => {
      return item.relativePath != oldRelativePath;
    });

    // Add new
    self.items.push({ file: basename(newRelativePath), directory: dirname(newRelativePath), relativePath: newRelativePath, size: size });
    self.storeCache();
    self.emit('finder-items-cache-queue:update', self.items);
  }

  deleteFile(relativePath) {
    const self = this;

    if (!self.items) return;
    if (!self.loadTask && !self.loadCache()) return;

    self.items = self.items.filter((item) => {
      return item.relativePath != relativePath;
    });
    self.storeCache();
    self.emit('finder-items-cache-queue:update', self.items);
  }

  refreshDirectory(directory, files) {
    const self = this;

    if (!self.items || !files) return;
    if (!self.loadTask && !self.loadCache()) return;

    // Remove old files in same directory
    self.items = self.items.filter((item) => {
      return item.directory != directory;
    });

    // Add new files for same directory
    files.forEach((file) => {
      self.items.push({ file: file.name, directory: directory, relativePath: directory + file.name, size: file.size });
    });

    self.storeCache();
    self.emit('finder-items-cache-queue:update', self.items);
  }

  renameDirectory(oldRelativePath, newRelativePath) {
    const self = this;

    if (!self.items) return;
    if (!self.loadTask && !self.loadCache()) return;

    // get files
    let items = self.items.filter((item) => {
      return item.directory.startsWith(oldRelativePath);
    });

    // Remove files in directory
    self.items = self.items.filter((item) => {
      return !item.directory.startsWith(oldRelativePath);
    });

    // Add new files for directory
    items.forEach((item) => {
      self.items.push({ file: item.file, directory: item.directory.replace(oldRelativePath, newRelativePath), relativePath: item.relativePath.replace(oldRelativePath, newRelativePath), size: item.size });
    });

    self.storeCache();
    self.emit('finder-items-cache-queue:update', self.items);
  }

  deleteDirectory(relativePath) {
    const self = this;

    if (!self.items) return;
    if (!self.loadTask && !self.loadCache()) return;

    // Remove files in directory
    self.items = self.items.filter((item) => {
      return !item.directory.startsWith(relativePath);
    });

    self.storeCache();
    self.emit('finder-items-cache-queue:update', self.items);
  }
}

module.exports = FinderItemsCache;
