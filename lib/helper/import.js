'use babel';

const atom = global.atom;
const Path = require('path');
const FileSystem = require('fs-plus');
const Electron = require('electron');
const Storage = require('./../helper/storage.js');
const XMLParser = require('xml-js');
const server_config = require('./../config/server-schema.json');
const folder_config = require('./../config/folder-schema.json');

class Import {
  constructor() {
    const self = this;
  }

  import(configuration_view) {
    const self = this;
    Electron.remote.dialog.showOpenDialog(null, { title: 'Select file to import', defaultPath: Electron.remote.app.getPath("desktop"), buttonLabel: 'Import', filters: [{ name: 'FileZilla site export file', extensions: ['xml'] }], properties: ['openFile', 'showHiddenFiles'] }, (filePaths, bookmarks) => {
      if (filePaths) {
        filePaths.forEach((filePath, index) => {
          FileSystem.readFile(filePath, function (err, data) {
            var json = XMLParser.xml2js(data, { compact: true });
            if (typeof json['FileZilla3'] !== 'undefined') {
              self.importFileZilla3(json['FileZilla3']['Servers']['Folder'], null);
              configuration_view.reload();
            }
          });
        });
      }

    });
  }

  importFileZilla3(data, parent) {
    const self = this;
    if (typeof data['Server'] !== 'undefined') {
      if (!Array.isArray(data['Server'])) {
        data['Server'] = [data['Server']];
      }
      data['Server'].forEach((server_data, index) => {
        let newconfig = JSON.parse(JSON.stringify(server_config));
        newconfig.name = server_data['Name']['_text'];
        newconfig.host = server_data['Host']['_text'];
        newconfig.port = server_data['Port']['_text'];
        newconfig.user = server_data['User']['_text'];
        if (typeof server_data['Pass'] !== 'undefined')
          newconfig.password = Buffer.from(server_data['Pass']['_text'], server_data['Pass']['_attributes']['encoding']).toString();
        newconfig.sftp = (server_data['Protocol']['_text'] == '1');
        newconfig.remote = server_data['RemoteDir']['_text'] || '/';
        newconfig.parent = parent;
        Storage.addServer(newconfig);
      });
    }
    if (typeof data['Folder'] !== 'undefined') {
      if (!Array.isArray(data['Folder'])) {
        data['Folder'] = [data['Server']];
      }
      data['Folder'].forEach((folder_data, index) => {
        let newconfig = JSON.parse(JSON.stringify(folder_config));
        newconfig.name = folder_data['_text'];
        newconfig.parent = parent;
        Storage.addFolder(newconfig);
        self.importFileZilla3(folder_data, newconfig.id);
      });
    }
  }

}
module.exports = new Import;
