'use babel';

import { basename, dirname, leadingslashit, trailingslashit, unleadingslashit, untrailingslashit, normalize, cleanJsonString } from './../helper/format.js';
import { decrypt, encrypt } from './../helper/secure.js';
import { throwErrorIssue44 } from './../helper/issue.js';

const atom = global.atom;
const server_config = require('./../config/server-schema.json');
const folder_config = require('./../config/folder-schema.json');

class Storage {

    constructor() {
      const self = this;

      self.servers = [];
      self.folders = [];
      self.version = '';
      self.password = null;
      self.loaded = false;
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

        if(!self.loaded || reload) {
            let configText = atom.config.get('ftp-remote-edit.config');
            if (configText) {
              configText = decrypt(self.password, configText);

              try {
                  configArray = self.migrate(JSON.parse(cleanJsonString(configText)));
                  self.loadServers(configArray.servers);
                  self.loadFolders(configArray.folders);

              } catch (e) {
                throwErrorIssue44(e, self.password);
              }

            }
            self.loaded = true;
        }

        return self.loaded;
    }

    save() {
        const self = this;

        atom.config.set('ftp-remote-edit.config', encrypt(self.password, JSON.stringify({version:self.version,servers:self.servers,folders:self.folders})));
    }

    loadServers(servers) {
        const self = this;

        servers.forEach((item, index) => {
            let cleanconfig = JSON.parse(JSON.stringify(server_config));
            if (!item.name) item.name = cleanconfig.name + " " + (index + 1);
            if (!item.host) item.host = cleanconfig.host;
            if (!item.port) item.port = cleanconfig.port;
            if (!item.user) item.user = cleanconfig.user;
            if (!item.password) item.password = cleanconfig.password;
            if (!item.sftp) item.sftp = cleanconfig.sftp;
            if (!item.privatekeyfile) item.privatekeyfile = cleanconfig.privatekeyfile;
            if (!item.remote) item.remote = cleanconfig.remote;

            if (item.useAgent) {
              item.logon = 'agent';
            } else if (item.privatekeyfile) {
              item.logon = 'keyfile';
            } else {
              item.logon = 'credentials';
            }
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

    getServers() {
        const self = this;
        if(!self.loaded)
            self.load();
        return self.servers;
    }

    addServer(server) {
        const self = this;
        if(!self.loaded)
            self.load();
        self.servers.push(server);
    }

    deleteServer(index) {
        const self = this;
        if(!self.loaded)
            self.load();
        self.servers.splice(index, 1);
    }

    loadFolders(folders) {
        const self = this;

        folders.forEach((item, index) => {
            let cleanconfig = JSON.parse(JSON.stringify(folder_config));
            if (!item.name) item.name = cleanconfig.name + " " + (index + 1);
            if (!item.parent) item.parent = null;
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
        if(!self.loaded)
            self.load();
        return self.folders;
    }

    getFolder(id) {
        const self = this;
        if(!self.loaded)
            self.load();
        return self.folders.find(function(element,index,array) { return element.id == this; },parseInt(id));
    }

    addFolder(folder) {
        const self = this;
        if(!self.loaded)
            self.load();
        folder.id = self.nextFolderId();
        self.folders.push(folder);
        return folder;
    }

    deleteFolder(id) {
        const self = this;
        if(!self.loaded)
            self.load();
        self.folders.splice(self.folders.findIndex(function(element,index,array) { return element.id == this; },parseInt(id)), 1);
    }

    nextFolderId() {
        const self = this;
        if(self.folders.length>0) {
            return parseInt(Math.max.apply(null, self.folders.map(function(f) { return f.id; })) + 1);
        } else {
            return 1;
        }
    }

    migrate(configArray) {
        if(typeof configArray.version === 'undefined') {
            let newConfigArray = {};
            newConfigArray.version = atom.packages.getActivePackage('ftp-remote-edit').metadata.version;
            newConfigArray.servers = configArray;
            newConfigArray.servers.forEach((item, index) => {
              item.parent = null;
            });
            newConfigArray.folders = [];
            configArray = newConfigArray;
        }
        return configArray;
    }
}
module.exports = new Storage;
