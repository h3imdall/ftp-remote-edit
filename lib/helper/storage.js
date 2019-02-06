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
              try {
                configText = JSON.stringify(JSON.parse(cleanJsonString(configText)), null, 4);
              } catch (e) {
                configText = decrypt(self.password, configText);
              }

              try {
                  configArray = JSON.parse(cleanJsonString(configText));

                  if(configArray.version instanceof String) {
                      self.version = configArray.version;
                  } else {
                      self.version = atom.packages.getActivePackage('ftp-remote-edit').metadata.version;
                  }

                  if(typeof configArray.servers === 'undefined' && configArray instanceof Array) {
                      self.loadServers(configArray);
                  } else if(configArray.servers instanceof Array) {
                      self.loadServers(configArray.servers);
                  }

                  if(configArray.folders instanceof Array) {
                      self.loadFolders(configArray.folders);
                  }

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
        self.servers.push(server);
    }

    deleteServer(index) {
        const self = this;
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
}
module.exports = new Storage;
