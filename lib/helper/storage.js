'use babel';

import { cleanJsonString } from './../helper/format.js';
import { compareVersions } from './../helper/helper.js';
import { decrypt, encrypt } from './../helper/secure.js';
import { throwErrorIssue44 } from './../helper/issue.js';

const atom = global.atom;
const Path = require('path');
const FileSystem = require('fs-plus');

const server_config = require('./../config/server-schema.json');
const folder_config = require('./../config/folder-schema.json');

class Storage {

  constructor() {
    const self = this;

    self.servers = [];
    self.folders = [];
    self.version = '';
    self.settings = {};
    self.password = null;
    self.loaded = false;
    self.tree = null;
  }

  setPassword(password) {
    const self = this;

    self.password = password;
  }

  getPassword() {
    const self = this;

    return self.password;
  }

  hasPassword() {
    const self = this;

    return self.password !== null;
  }

  load(reload = false) {
    const self = this;

    if (!self.loaded || reload) {
      let configText = atom.config.get('ftp-remote-edit.config');
      if (configText) {
        configText = decrypt(self.password, configText);

        try {
          configArray = self.migrate(JSON.parse(cleanJsonString(configText)));
          self.loadServers(configArray.servers);
          self.loadFolders(configArray.folders);
          self.loadSettings(configArray.settings);
        } catch (e) {
          throwErrorIssue44(e, self.password);
        }

      }
      self.loaded = true;
      self.tree = null;
      self.version = atom.packages.getActivePackage('ftp-remote-edit').metadata.version;
      self.settings = {};
    }

    return self.loaded;
  }

  save() {
    const self = this;

    atom.config.set('ftp-remote-edit.config', encrypt(self.password, JSON.stringify({
      version: self.version,
      servers: self.servers,
      folders: self.folders,
      settings: self.settings
    })));
  }

  loadServers(servers) {
    const self = this;

    servers = servers.map((item, index) => {
      let cleanconfig = JSON.parse(JSON.stringify(server_config));

      cleanconfig.name = (item.name) ? item.name : cleanconfig.name + " " + (index + 1);
      cleanconfig.host = (item.host) ? item.host : cleanconfig.host;
      cleanconfig.port = (item.port) ? item.port : cleanconfig.port;
      cleanconfig.user = (item.user) ? item.user : cleanconfig.user;
      cleanconfig.secure = (item.secure) ? item.secure : cleanconfig.secure;
      cleanconfig.parent = (item.parent) ? item.parent : cleanconfig.parent;
      cleanconfig.useAgent = (item.useAgent) ? item.useAgent : cleanconfig.useAgent;
      cleanconfig.password = (item.password) ? item.password : cleanconfig.password;
      cleanconfig.sftp = (item.sftp) ? item.sftp : cleanconfig.sftp;
      cleanconfig.privatekeyfile = (item.privatekeyfile) ? item.privatekeyfile : cleanconfig.privatekeyfile;
      cleanconfig.remote = (item.remote) ? item.remote : cleanconfig.remote;
      cleanconfig.temp = (item.temp) ? item.temp : cleanconfig.temp;

      if (cleanconfig.useAgent) {
        cleanconfig.logon = 'agent';
      } else if (item.privatekeyfile) {
        cleanconfig.logon = 'keyfile';
      } else {
        cleanconfig.logon = 'credentials';
      }

      return cleanconfig;
    });

    let sortServerProfilesByName = atom.config.get('ftp-remote-edit.tree.sortServerProfilesByName');
    servers.sort((a, b) => {
      if (sortServerProfilesByName) {
        if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
        if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
      } else {
        if (a.host.toLowerCase() < b.host.toLowerCase()) return -1;
        if (a.host.toLowerCase() > b.host.toLowerCase()) return 1;
      }
      return 0;
    });

    self.servers = servers;

    return self.servers;
  }

  getTree() {
    const self = this;

    if (self.tree == null) {
      let map = {};
      let root = { name: 'root', children: [] };
      let tree_folders = [];

      self.folders.forEach((item, index) => {
        map[item.id] = tree_folders.push({ name: item.name, parent: item.parent, children: [] }) - 1;
      });

      tree_folders.sort(function (a, b) {
        if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
        if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
        return 0;
      });

      tree_folders.forEach((item, index) => {
        if (item.parent !== null && typeof map[item.parent] !== 'undefined' && tree_folders[map[item.parent]] !== 'undefined') {
          tree_folders[map[item.parent]].children.push(item);
        } else {
          root.children.push(item);
        }
      });

      self.getServers().forEach((item, index) => {
        if (typeof item.parent != 'undefined' && item.parent !== null) {
          tree_folders[map[item.parent]].children.push(item);
        } else {
          root.children.push(item);
        }
      });

      self.tree = root;
    }

    return self.tree;
  }

  getServers() {
    const self = this;

    if (!self.loaded) {
      self.load();
    }

    return self.servers;
  }

  addServer(server) {
    const self = this;

    if (!self.loaded) {
      self.load();
    }

    self.servers.push(server);
    self.tree = null;
  }

  deleteServer(index) {
    const self = this;

    if (!self.loaded) {
      self.load();
    }

    self.servers.splice(index, 1);
    self.tree = null;
  }

  getServerByName(name) {
    const self = this;

    if (!self.loaded) {
      self.load();
    }

    return self.servers.find((element) => { return element.name == name; });
  }

  loadFolders(folders) {
    const self = this;

    folders = folders.map((item, index) => {
      let cleanconfig = JSON.parse(JSON.stringify(folder_config));

      cleanconfig.id = (item.id) ? item.id : (index + 1);
      cleanconfig.name = (item.name) ? item.name : cleanconfig.name + " " + (index + 1);
      cleanconfig.parent = (item.parent) ? item.parent : cleanconfig.parent;

      return cleanconfig;
    });

    folders.sort((a, b) => {
      if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
      if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
      return 0;
    });

    self.folders = folders;

    return self.folders;
  }

  getFolders() {
    const self = this;

    if (!self.loaded) {
      self.load();
    }

    return self.folders;
  }

  getFoldersStructuredByTree() {
    const self = this;
    let map = {};
    let root = { name: 'root', children: [] };
    let tree_folders = [];

    self.folders.forEach((item, index) => {
      map[item.id] = tree_folders.push({ id: item.id, name: item.name, parent: item.parent, children: [] }) - 1;
    });

    tree_folders.sort(function (a, b) {
      if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
      if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
      return 0;
    });

    tree_folders.forEach((item, index) => {
      if (item.parent !== null && typeof map[item.parent] !== 'undefined' && tree_folders[map[item.parent]] !== 'undefined') {
        tree_folders[map[item.parent]].children.push(item);
      } else {
        root.children.push(item);
      }
    });

    let getFoldersAsArray = function (elements, level = 0, array = [], parents_id = []) {
      elements.forEach((item, index) => {
        item.name = '-'.repeat(level) + ' ' + item.name;
        item.parents_id = parents_id;
        array.push(item);
        getFoldersAsArray(item.children, level + 1, array, parents_id.concat(item.id));
      });

      return array;
    };

    return getFoldersAsArray(root.children);
  }

  getFolder(id) {
    const self = this;

    if (!self.loaded) {
      self.load();
    }

    return self.folders.find((element) => { return element.id === parseInt(id); });
  }

  getFolderByName(name) {
    const self = this;

    if (!self.loaded) {
      self.load();
    }

    return self.folders.find((element) => { return element.name == name; });
  }

  addFolder(folder) {
    const self = this;

    if (!self.loaded) {
      self.load();
    }

    folder.id = self.nextFolderId();
    self.folders.push(folder);
    self.tree = null;

    return folder;
  }

  deleteFolder(id) {
    const self = this;

    if (!self.loaded) {
      self.load();
    }

    let selected_folder = self.getFolder(id);
    let new_parent = selected_folder.parent || null;

    self.folders.splice(self.folders.findIndex((element) => { return element.id === parseInt(id); }), 1);

    self.folders.forEach((item, index) => {
      if (item.parent == parseInt(id)) {
        item.parent = new_parent;
      }
    });

    self.servers.forEach((item, index) => {
      if (item.parent == parseInt(id)) {
        item.parent = new_parent;
      }
    });

    self.tree = null;
  }

  nextFolderId() {
    const self = this;

    if (self.folders.length > 0) {
      return parseInt(Math.max.apply(null, self.folders.map((folder) => { return folder.id; })) + 1);
    } else {
      return 1;
    }
  }

  loadSettings(settings) {
    self.settings = settings || {};
  }

  migrate(configArray) {
    const self = this;

    // since 0.14.0
    if (typeof configArray.version === 'undefined') {
      // backup current config
      self.backup(atom.packages.getActivePackage('ftp-remote-edit').metadata.version);

      // migrate
      let newConfigArray = {};
      newConfigArray.servers = configArray;
      newConfigArray.servers.forEach((item, index) => {
        item.parent = null;
      });
      newConfigArray.folders = [];
      configArray = newConfigArray;

      // Init first version
      configArray.version = '0.14.0';
    }

    // since 0.14.2
    if (configArray.version == '') {
      // Fix error storing empty version
      configArray.version = '0.14.2';
    }
  
    // since 0.15.0
    if (compareVersions(configArray.version, '0.15.0') < 0) {
      // backup current config
      self.backup('0.15.0');

      // migrate
      configArray.settings = {};
    }

    return configArray;
  }

  backup(version) {
    const src = atom.config.getUserConfigPath();
    const dest = Path.dirname(atom.config.getUserConfigPath()) + Path.sep + 'ftp-remote-edit-config.cson.' + version;

    try {
      FileSystem.copyFileSync(src, dest);
    } catch (e) {
      console.log('Backup failed: ' + src + '->' + dest);
    }
  }
}
module.exports = new Storage;
