'use babel';

import Node from './Node.js';
import Ftp from './connectors/ftp.js';
import Sftp from './connectors/sftp.js';

import FtpRemoteEditView from './views/ftp-remote-edit-view';
import ListView from './views/list-view.js';
import DirectoryView from './views/directory-view.js';
import FileView from './views/file-view.js';

import PromptPassDialog from './dialogs/prompt-pass-dialog.js';

import {
    CompositeDisposable,
    TextEditor
} from 'atom';

const atom = global.atom;
const config = require('./config/config-schema.json');

export default {

    constructor() {
        const self = this;
        self.info = null;
        self.config = config;
        self.modalPanel = null;
        self.listeners = [];
        self.ftpRemoteEditView = null;
    },

    activate() {
        const self = this;

        // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
        self.listeners = new CompositeDisposable();

        // Register command that toggles this view
        self.listeners.add(atom.commands.add('atom-workspace', {
            'ftp-remote-edit:toggle': () => self.toggle(),
            'ftp-remote-edit:editconfiguration': () => selfeditconfiguration(),
            'ftp-remote-edit:closePanel': () => self.closePanel(),
            'ftp-remote-edit:new-file': () => self.newFile(state),
            'ftp-remote-edit:new-directory': () => self.newDirectory(state),
            'ftp-remote-edit:deleteFile': () => self.deleteFile(),
            'ftp-remote-edit:deleteDirectory': () => self.deleteDirectory(),
            'ftp-remote-edit:rename': () => self.rename('directory'),
            'ftp-remote-edit:rename-file': () => self.rename('file')
        }));

        self.ftpRemoteEditView = new FtpRemoteEditView();
        self.ftpRemoteEditView.detach();

        self.promptForPass();
    },

    deactivate() {
        // const self = this;
        // self.modalPanel.destroy();
        // self.listeners.dispose();
        // self.ftpRemoteEditView.destroy();
    },

    promptForPass() {
        const self = this;
        const dialog = new PromptPassDialog('', true);

        dialog.on('dialog-done', (e, pass) => {
            self.info.pass = pass;
            self.info.passphrase = pass;
            dialog.close();
        });
        dialog.attach();
    },

    serialize() {
        return {};
    },

    toggle() {
        if (atom.config.get('ftp-remote-edit.reset') === true) {
            // Set master Password for the first time
            this.editconfiguration();
        } else {
            this.ftpRemoteEditView = new FtpRemoteEditView();
            this.modalPanel = atom.workspace.addModalPanel({
                item: this.ftpRemoteEditView,
            });
            this.ftpRemoteEditView.setPanel(this.modalPanel);
            this.ftpRemoteEditView.miniEditor.element.focus();
            this.modalPanel.getItem().setState('connectionview');
        }


        return true;
    },

    editconfiguration() {

        this.ftpRemoteEditView = new FtpRemoteEditView();
        this.modalPanel = atom.workspace.addModalPanel({
            item: this.ftpRemoteEditView,
        });
        this.ftpRemoteEditView.setPanel(this.modalPanel);
        this.ftpRemoteEditView.miniEditor.element.focus();

        this.modalPanel.getItem().setState('editview');
        return true;
    },

    closePanel() {

        let leftPanels = atom.workspace.getLeftPanels();
        leftPanels.forEach((item) => {
            if (item.getItem() instanceof Node) {
                item.destroy();
            }
        });

    },

    newFile(state) {

        let dir = document.querySelector('.list > .directory > .selected');
        let serverPath = dir.node.getPathOnServer();
        let ftp = null
        if (dir.node.getConnection().sftp === true) {
            ftp = new Sftp(dir.node.getConnection());
        } else {
            ftp = new Ftp(dir.node.getConnection());
        }


        let dirChild = document.querySelector('.list > .directory > .selected').parentNode.querySelectorAll('.list')[1];
        if (dirChild === undefined) {

            dir.node.openDirectory().then(() => {
                dirChild = document.querySelector('.list > .directory > .selected').parentNode.querySelectorAll('.list')[1];
                setInputField(dirChild);
            });

        } else {
            setInputField(dirChild);
        }

        function setInputField(dirChild) {
            let input = new TextEditor({
                mini: true
            });
            let dirList = document.querySelector('.list > .directory > .selected').parentNode.querySelector('.list');

            dirList.insertBefore(input.element, dirList.childNodes[0]);
            input.element.focus();

            atom.commands.add(input.element, 'core:confirm', () => {

                if (/[<>:"\/\\|?*\x00-\x1F]/.test(input.getText()) === false && input.getText() !== '') {

                    let newfile = serverPath + '/' + input.getText().trim();
                    let fileName = input.getText().trim();
                    newfile = newfile.trim();
                    fileExists = document.querySelector('[pathonserver="' + newfile.trim() + '"]');

                    if (fileExists === null) {

                        ftp.saveFileToServer('', newfile.trim()).then(() => {

                            let li = new FileView({
                                name: fileName,
                                pathOnServer: newfile
                            });
                            let pathList = [];

                            dirChild.childNodes.forEach((item) => {
                                pathList.push(item.getAttribute('pathonserver'));
                            });
                            pathList.push(newfile);

                            pathList = pathList.sort(function(a, b) {
                                if (a < b) return -1;
                                if (a > b) return 1;
                                return 0;
                            });

                            let indexOfNewPath = pathList.indexOf(newfile);

                            li.setConnection(dir.node.getConnection());
                            dirChild.insertBefore(li.element, dirChild.childNodes[indexOfNewPath]);
                            li.getElement().querySelector('.message').click();
                        });

                        destroy();
                    }
                }


            });

            input.element.addEventListener('blur', destroy);

            function destroy() {
                input.element.removeEventListener('blur', destroy);
                input.element.remove();
                input.destroy();
            }

        }

    },

    newDirectory(state) {

        let dir = document.querySelector('.list > .directory > .selected');
        let serverPath = dir.node.getPathOnServer();
        let ftp = null
        if (dir.node.getConnection().sftp === true) {
            ftp = new Sftp(dir.node.getConnection());
        } else {
            ftp = new Ftp(dir.node.getConnection());
        }

        let dirChild = document.querySelector('.list > .directory > .selected').parentNode.querySelector('.list');
        if (dirChild === null) {

            dir.node.openDirectory().then(() => {
                dirChild = document.querySelector('.list > .directory > .selected').parentNode.querySelector('.list');
                setInputField(dirChild);
            });

        } else {
            setInputField(dirChild);
        }

        function setInputField(dirChild) {
            let input = new TextEditor({
                mini: true
            });
            dirChild.insertBefore(input.element, dirChild.childNodes[0]);
            input.element.focus();

            atom.commands.add(input.element, 'core:confirm', () => {

                if (/[<>:"\/\\|?*\x00-\x1F]/.test(input.getText()) === false && input.getText() !== '') {

                    let newDir = serverPath + '/' + input.getText();
                    let dirName = input.getText();
                    dirExists = document.querySelector('[pathonserver="' + newDir + '"]');

                    if (dirExists === null) {

                        ftp.createDirectory(newDir).then(() => {

                            let li = new DirectoryView({
                                name: dirName,
                                pathOnServer: newDir
                            });
                            let pathList = [];
                            dirChild.childNodes.forEach((item) => {
                                pathList.push(item.getAttribute('pathonserver'));
                            });
                            pathList.push(newDir);

                            pathList = pathList.sort(function(a, b) {
                                if (a < b) return -1;
                                if (a > b) return 1;
                                return 0;
                            });

                            let indexOfNewPath = pathList.indexOf(newDir);

                            li.setConnection(dir.node.getConnection());
                            dirChild.insertBefore(li.element, dirChild.childNodes[indexOfNewPath]);

                        });

                        destroy();
                    }
                }


            });

            input.element.addEventListener('blur', destroy);

            function destroy() {
                input.element.removeEventListener('blur', destroy);
                input.element.remove();
                input.destroy();
            }

        }
    },

    deleteFile() {

        let dir = document.querySelector('.list > .file > .selected');
        let serverPath = dir.node.getPathOnServer();
        let ftp = null
        if (dir.node.getConnection().sftp === true) {
            ftp = new Sftp(dir.node.getConnection());
        } else {
            ftp = new Ftp(dir.node.getConnection());
        }

        atom.confirm({
            message: 'Do you want to delete this file?',
            buttons: {
                Yes: () => {
                    ftp.delete(serverPath).then(() => {
                        dir.parentNode.remove();
                        dir.node.destroy();
                    });
                },
                Cancel: () => {
                    return true;
                }
            }
        });


    },

    deleteDirectory() {

        atom.confirm({
            message: 'Do you want to delete this Directory and all of its content?',
            buttons: {
                'Yes': () => {
                    let dir = document.querySelector('.list > .directory > .selected');
                    let serverPath = dir.node.getPathOnServer();
                    let ftp = null
                    if (dir.node.getConnection().sftp === true) {
                        ftp = new Sftp(dir.node.getConnection());
                    } else {
                        ftp = new Ftp(dir.node.getConnection());
                    }


                    dir.node.loader = dir.node.createLoader();
                    dir.node.getElement().appendChild(dir.node.loader);

                    ftp.deleteDirectory(serverPath).then(() => {
                        dir.parentNode.remove();
                        dir.node.destroy();
                        dir.node.loader.remove();
                    });
                },
                'Cancel': () => {
                    return true;
                }
            }
        });

    },

    /**
     *
     * @param {String} element
     */
    rename(element) {

        console.log(element);

        let input = new TextEditor({
            mini: true
        });
        let dir = '';
        let messageElement = '';
        if (element === 'file') {
            dir = document.querySelector('.list > .file > .selected');
            messageElement = dir;
        } else if (element === 'directory') {
            dir = document.querySelector('.list > .directory > .selected');
            messageElement = dir.querySelector('.message');;
        }

        let serverPath = dir.node.getPathOnServer();
        let ftp = null
        if (dir.node.getConnection().sftp === true) {
            ftp = new Sftp(dir.node.getConnection());
        } else {
            ftp = new Ftp(dir.node.getConnection());
        }


        input.element.addEventListener('blur', destroy);

        atom.commands.add(input.element, 'core:confirm', () => {

            let newDir = input.getText();
            let oldPathArr = serverPath.split('/');
            oldPathArr.pop();
            oldPathArr.push(newDir);
            newDir = oldPathArr.join('/').trim();

            ftp.rename(serverPath, newDir).then(() => {
                dir.parentNode.setAttribute('pathonserver', newDir);
                messageElement.textContent = input.getText();
                destroy();
            });

        });

        function destroy() {
            input.element.removeEventListener('blur', destroy);
            dir.removeAttribute('hidden');
            input.element.remove();
            input.destroy();
        }

        dir.setAttribute('hidden', true);
        dir.parentNode.appendChild(input.element);
        input.setText(messageElement.textContent);
        input.element.focus();

    }

};
