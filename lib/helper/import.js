'use babel';

import { normalize } from './format.js';

const server_config = require('./../config/server-schema.json');
const folder_config = require('./../config/folder-schema.json');

const atom = global.atom;
const FileSystem = require('fs-plus');
const Electron = require('electron');
const XMLParser = require('xml-js');
const Storage = require('./storage.js');

class Import {
  constructor() {
    const self = this;

    self.onError = (error) => { };
    self.onWarning = (error) => { };
    self.onFinished = (statistic) => { };
  }

  import() {
    const self = this;

    Electron.remote.dialog.showOpenDialog(null, { title: 'Select file to import', defaultPath: Electron.remote.app.getPath("desktop"), buttonLabel: 'Import', filters: [{ name: 'All Files', extensions: ['*'] }, { name: 'FileZilla', extensions: ['xml'] }, { name: 'PHP Storm', extensions: ['xml'] }, { name: 'Remote-Ftp', extensions: ['ftpconfig'] }], properties: ['openFile', 'showHiddenFiles'] }, (filePaths, bookmarks) => {
      if (filePaths) {
        filePaths.forEach((filePath, index) => {
          if (filePath.toLowerCase().endsWith('.xml') || filePath.toLowerCase().endsWith('.ftpconfig')) {
            FileSystem.readFile(filePath, function (error, data) {
              if (error) {
                self.onError(new Error('Opening file failed'));
              } else {
                if (filePath.toLowerCase().endsWith('.xml')) {
                  try {
                    const json = XMLParser.xml2js(data, { compact: true });
                    if (typeof json['FileZilla3'] !== 'undefined') {
                      self.onFinished(self.importFileZilla3(json['FileZilla3']['Servers'], null));
                    } else if (typeof json['application']['component']['option'] !== 'undefined') {
                      self.onFinished(self.importPHPStorm(json['application']['component']['option']['webServer'], null));
                    }
                  } catch (error) {
                    self.onError(new Error('Parsing file failed'));
                  }
                } else if (filePath.toLowerCase().endsWith('.ftpconfig')) {
                  try {
                    const json = JSON.parse(data);
                    self.onFinished(self.importFtpConfig(json));
                  } catch (error) {
                    self.onError(new Error('Parsing file failed'));
                  }
                }
              }
            });
          } else {
            self.onError(new Error('Unknown file format'));
          }
        });
      } else {
        self.onWarning(new Error('No import file has not been selected'));
      }
    });
  }

  importFileZilla3(data, parent) {
    const self = this;
    let createdServers = 0;
    let updatedServers = 0;
    let createdFolders = 0;

    if (typeof data['Server'] !== 'undefined') {
      if (!Array.isArray(data['Server'])) {
        data['Server'] = [data['Server']];
      }
      data['Server'].forEach((serverData, index) => {
        let newconfig = Storage.getServerByName(serverData['Name']['_text']);
        let newServer = true;

        if (typeof newconfig === 'undefined') {
          newconfig = JSON.parse(JSON.stringify(server_config));
          createdServers++;
        } else {
          updatedServers++;
          newServer = false;
        }

        newconfig.name = serverData['Name']['_text'];
        newconfig.host = serverData['Host']['_text'];
        if (typeof serverData['Port'] !== 'undefined')
          newconfig.port = serverData['Port']['_text'];
        if (typeof serverData['User'] !== 'undefined')
          newconfig.user = serverData['User']['_text'];
        if (typeof serverData['Pass'] !== 'undefined') {
          if (serverData['Pass']['_attributes']['encoding'] == 'base64') {
            newconfig.password = Buffer.from(serverData['Pass']['_text'], serverData['Pass']['_attributes']['encoding']).toString();
          } else if (serverData['Pass']['_attributes']['encoding'] == 'crypt') {
            atom.notifications.addWarning('Not implemented import from FileZilla!', {
              detail: "Filezilla import with crypted password has not been implemented! Saved empty password for " + newconfig.name + "!",
              dismissable: true,
            });
          } else if (serverData['Pass']['_attributes']['encoding'] == 'plain') {
            newconfig.password = serverData['Pass']['_text'], serverData['Pass']['_attributes']['encoding'];
          } else {
            atom.notifications.addWarning('Not recognized encoding method for password!', {
              detail: "Couldn't recognize password type for server " + newconfig.name + " in FileZilla import file. Saved empty password.",
              dismissable: true,
            });
          }
        }
        newconfig.sftp = (serverData['Protocol']['_text'] == '1');
        newconfig.remote = serverData['RemoteDir']['_text'] || '';

        // Convert FileZilla path
        if (newconfig.remote.length > 0) {
          let parts = newconfig.remote.split(' ');
          let segments = ['/'];

          // Remove type and stop
          const type = parts.shift();
          const stop = parts.shift();

          // parse segments
          while (parts.length > 0) {
            const segmentLength = parts.shift();
            segments.push(parts.shift());
          }
          newconfig.remote = normalize(segments.join('/'));
        }

        newconfig.parent = parent;
        if (newServer) {
          Storage.addServer(newconfig);
        }
      });
    }

    if (typeof data['Folder'] !== 'undefined') {
      if (!Array.isArray(data['Folder'])) {
        data['Folder'] = [data['Folder']];
      }
      data['Folder'].forEach((folderData, index) => {
        let newconfig = Storage.getFolderByName(folderData['_text']);
        if (typeof newconfig === 'undefined') {
          newconfig = JSON.parse(JSON.stringify(folder_config));
          newconfig.name = folderData['_text'];
          newconfig.parent = parent;
          Storage.addFolder(newconfig);
          createdFolders++;
        }
        let imported = self.importFileZilla3(folderData, newconfig.id);
        createdServers += imported.createdServers;
        updatedServers += imported.updatedServers;
        createdFolders += imported.createdFolders;
      });
    }

    return { createdServers: createdServers, updatedServers: updatedServers, createdFolders: createdFolders };
  }

  importFtpConfig(data) {
    const self = this;
    let createdServers = 0;
    let updatedServers = 0;

    let name = ((typeof data['user'] !== 'undefined') ? (data['user'] + '@') : '') + data['host'];
    let newconfig = Storage.getServerByName(name);
    if (typeof newconfig === 'undefined') {
      newconfig = JSON.parse(JSON.stringify(server_config));
      createdServers++;
    } else {
      updatedServers++;
    }
    newconfig.name = name;
    newconfig.host = data['host'];
    if (typeof data['port'] !== 'undefined')
      newconfig.port = data['port'];
    if (typeof data['user'] !== 'undefined')
      newconfig.user = data['user'];
    if (typeof data['pass'] !== 'undefined')
      newconfig.password = data['pass'];
    newconfig.sftp = (data['protocol'] == 'sftp');
    newconfig.remote = data['remote'];
    if (createdServers > 0) {
      Storage.addServer(newconfig);
    }

    return { createdServers: createdServers, updatedServers: updatedServers, createdFolders: 0 };
  }

  importPHPStorm(data) {
    const self = this;
    let createdServers = 0;
    let updatedServers = 0;

    data.forEach((serverData, index) => {
      let newconfig = Storage.getServerByName(serverData['_attributes']['name']);
      let newServer = true;
      if (typeof newconfig === 'undefined') {
        newconfig = JSON.parse(JSON.stringify(server_config));
        createdServers++;
      } else {
        updatedServers++;
        newServer = false;
      }
      newconfig.name = serverData['_attributes']['name'];
      newconfig.host = serverData['fileTransfer']['_attributes']['host'];
      if (typeof serverData['fileTransfer']['_attributes']['port'] !== 'undefined')
        newconfig.port = serverData['fileTransfer']['_attributes']['port'];
      newconfig.sftp = (serverData['fileTransfer']['_attributes']['accessType'] == 'SFTP');
      newconfig.remote = serverData['fileTransfer']['_attributes']['rootFolder'] || '';
      if (newServer) {
        Storage.addServer(newconfig);
      }
    });

    return { createdServers: createdServers, updatedServers: updatedServers, createdFolders: 0 };
  }
}
module.exports = Import;
