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

    var imported = { createdServers: 0, updatedServers: 0, createdFolders: 0 };
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
                  imported = self.importFileZilla3(json['FileZilla3']['Servers'], null);
                  self.importSuccess(imported);
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
                imported = self.importFtpConfig(json);
                self.importSuccess(imported);
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
        return true;
      } else {
        atom.notifications.addWarning('File to import has not been selected!', {
          dismissable: true,
        });
      }

    });
  }

  importSuccess(imported) {
    const self = this;
    let detail = [];

    if (imported.createdServers) {
      detail.push(imported.createdServers + " new servers");
    }
    if (imported.updatedServers) {
      detail.push(imported.updatedServers + " updated servers");
    }
    if (imported.createdFolders) {
      detail.push(imported.createdFolders + " new folders");
    }
    atom.notifications.addSuccess('Import completed!', {
      detail: 'Imported ' + detail.join(', ') + '.',
      dismissable: true,
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
    let createdFolders = 0;

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
    Storage.addServer(newconfig);

    return { createdServers: createdServers, updatedServers: updatedServers, createdFolders: createdFolders };
  }

}
module.exports = new Import;
