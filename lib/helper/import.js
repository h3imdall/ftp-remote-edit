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

  import(_callback) {
    const self = this;
    Electron.remote.dialog.showOpenDialog(null, { title: 'Select file to import', defaultPath: Electron.remote.app.getPath("desktop"), buttonLabel: 'Import', filters: [{ name: 'All Files', extensions: ['*'] }, { name: 'remote-ftp config file', extensions: ['ftpconfig'] }, { name: 'FileZilla site export file', extensions: ['xml'] }], properties: ['openFile', 'showHiddenFiles'] }, (filePaths, bookmarks) => {
      if (filePaths) {
        filePaths.forEach((filePath, index) => {
          if (Path.extname(filePath).toLowerCase() == '.xml') {
            FileSystem.readFile(filePath, function (e, data) {
              if (e) {
                console.error(e);
                atom.notifications.addError('Error in import on file opening!', {
                  detail: e.message,
                  dismissable: true,
                });
                return false;
              }
              try {
                var json = XMLParser.xml2js(data, { compact: true });
                if (typeof json['FileZilla3'] !== 'undefined') {
                  self.importFileZilla3(json['FileZilla3']['Servers'], null);
                  if (_callback instanceof Function)
                    _callback();
                }
              } catch (e) {
                console.error(e);
                atom.notifications.addError('Error in import on parsing xml file!', {
                  detail: e.message,
                  dismissable: true,
                });
                return false;
              }
            });
          } else if (Path.basename(filePath).toLowerCase() == '.ftpconfig') {
            FileSystem.readFile(filePath, function (e, data) {
              if (e) {
                console.error(e);
                atom.notifications.addError('Error in import on file opening', {
                  detail: e.message,
                  dismissable: true,
                });
                return false;
              }
              try {
                var json = JSON.parse(data);
                self.importFtpConfig(json);
                if (_callback instanceof Function)
                  _callback();
              } catch (e) {
                console.error(e);
                atom.notifications.addError('Error in import on parsing .ftpconfig file!', {
                  detail: e.message,
                  dismissable: true,
                });
                return false;
              }
            });

          }
        });
        atom.notifications.addSuccess('File has been imported!', {
          dismissable: true,
        });
        return true;
      }

    });
  }

  importFileZilla3(data, parent) {
    const self = this;
    if (typeof data['Server'] !== 'undefined') {
      if (!Array.isArray(data['Server'])) {
        data['Server'] = [data['Server']];
      }
      data['Server'].forEach((serverData, index) => {
        let newconfig = JSON.parse(JSON.stringify(server_config));
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
        newconfig.parent = parent;
        Storage.addServer(newconfig);
      });
    }
    if (typeof data['Folder'] !== 'undefined') {
      if (!Array.isArray(data['Folder'])) {
        data['Folder'] = [data['Folder']];
      }
      data['Folder'].forEach((folder_data, index) => {
        let newconfig = Storage.getFolderByName(folder_data['_text']);
        if (typeof newconfig === 'undefined') {
          newconfig = JSON.parse(JSON.stringify(folder_config));
          newconfig.name = folder_data['_text'];
          newconfig.parent = parent;
          Storage.addFolder(newconfig);
        }
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
