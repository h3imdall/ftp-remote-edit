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
    Electron.remote.dialog.showOpenDialog(null, { title: 'Select file to import', defaultPath: Electron.remote.app.getPath("desktop"), buttonLabel: 'Import', filters: [{ name: 'All Files', extensions: ['*'] }, { name: 'remote-ftp config file', extensions: ['ftpconfig'] }, { name: 'FileZilla site export file', extensions: ['xml'] }], properties: ['openFile', 'showHiddenFiles'] }, (filePaths, bookmarks) => {
      if (filePaths) {
        filePaths.forEach((filePath, index) => {
          if (Path.extname(filePath).toLowerCase() == '.xml') {
            FileSystem.readFile(filePath, function (err, data) {
              var json = XMLParser.xml2js(data, { compact: true });
              if (typeof json['FileZilla3'] !== 'undefined') {
                self.importFileZilla3(json['FileZilla3']['Servers']['Folder'], null);
                configuration_view.reload();
              }
            });
          } else if (Path.basename(filePath).toLowerCase() == '.ftpconfig') {
            FileSystem.readFile(filePath, function (err, data) {
              var json = JSON.parse(data);
              self.importFtpConfig(json);
              configuration_view.reload();
            });

          }
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
        if (typeof server_data['Port'] !== 'undefined')
          newconfig.port = server_data['Port']['_text'];
        if (typeof server_data['User'] !== 'undefined')
          newconfig.user = server_data['User']['_text'];
        if (typeof server_data['Pass'] !== 'undefined')
          newconfig.password = Buffer.from(server_data['Pass']['_text'], server_data['Pass']['_attributes']['encoding']).toString();
        newconfig.sftp = (server_data['Protocol']['_text'] == '1');
        newconfig.remote = server_data['RemoteDir']['_text'] || '';
        newconfig.parent = parent;
        Storage.addServer(newconfig);
      });
    }
    if (typeof data['Folder'] !== 'undefined') {
      if (!Array.isArray(data['Folder'])) {
        data['Folder'] = [data['Folder']];
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

  importFtpConfig(data) {
    const self = this;
    let newconfig = JSON.parse(JSON.stringify(server_config));
    newconfig.host = data['host'];
    if (typeof data['port'] !== 'undefined')
      newconfig.port = data['port'];
    if (typeof data['user'] !== 'undefined') {
      newconfig.user = data['user'];
      newconfig.name = newconfig.user + '@' + newconfig.host;
    } else {
      newconfig.name = newconfig.host;
    }
    if (typeof data['pass'] !== 'undefined')
      newconfig.password = data['pass'];
    newconfig.sftp = (data['protocol'] == 'sftp');
    newconfig.remote = data['remote'];
    Storage.addServer(newconfig);
  }

}
module.exports = new Import;
