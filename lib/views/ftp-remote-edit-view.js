'use babel';

import {
    ScrollView
} from 'atom-space-pen-views';

import Secure from './../Secure.js';
import Node from './../Node.js';

import ConfigurationView from './configuration-view.js';
import DirectoryView from './directory-view.js';
import FileView from './file-view.js';
import ListView from './list-view.js';

const config = require('./../config/connection-schema.json');

export default class FtpRemoteEditView {

    constructor(serializedState) {

        // atom.commands.add(this.element, 'core:confirm', () => {
        //     let password = this.miniEditor.getText();
        //     let secure = new Secure();
        //
        //     // Password überprüfen
        //     if (atom.config.get('ftp-remote-edit.reset') === false) {
        //         if (secure.checkPassword(password) === false) {
        //             window.alert('Wrong Password');
        //             return false;
        //         }
        //     } else {
        //         // Passwort als hash speichern.
        //         atom.config.set('ftp-remote-edit.password', secure.encrypt(password, password));
        //     }
        //
        //     this.panel.destroy();
        //
        //
        //     if (this.state === 'editview') {
        //         let configView = new ConfigurationView(password);
        //         let modal = atom.workspace.addModalPanel({
        //             item: configView.getElement(),
        //             visible: true
        //         });
        //         configView.setModal(modal);
        //     } else {
        //         this.showFtpPanel(password);
        //     }
        //
        // });

    }

    showFtpPanel(password) {

        let leftPanels = atom.workspace.getLeftPanels();
        leftPanels.forEach((item) => {
            if (item.getItem() instanceof Node) {
                item.destroy();
            }
        });

        let secure = new Secure();
        let connectionHash = atom.config.get('ftp-remote-edit.config');
        let connectionString = secure.decrypt(password, connectionHash);
        let connectionArr = JSON.parse(connectionString);

        let div = new Node();
        div.getElement().classList.add('directory-list-box');

        connectionArr.sort(function(a, b) {
            if (a.host < b.host) return -1;
            if (a.host > b.host) return 1;
            return 0;
        });

        connectionArr.forEach((connection) => {

            let ul = new ListView();
            let li = new DirectoryView({
                name: connection.host,
                pathOnServer: ''
            }, true);

            div.append(ul);
            ul.setConnection(connection);
            ul.append(li);
        });

        this.ftpPanel = atom.workspace.addLeftPanel({
            item: div,
            visible: true,
            priority: 100
        });

    }

    attach = function() {
        if (atom.config.get('tree-view.showOnRightSide')) {
            this.panel = atom.workspace.addRightPanel({
                item: this
            });
        } else {
            this.panel = atom.workspace.addLeftPanel({
                item: this
            });
        }
    };

    detach() {
        const destroyPanel = this.panel;
        this.panel = null;
        if (destroyPanel) {
            destroyPanel.destroy();
        }
    }

    getDefaultConnectionValue() {

        return JSON.stringify([{
            "host": "",
            "user": "",
            "password": "",
            "port": "21",
            "sftp": false
        }], null, 4);

    }

    getElement() {
        return this.element;
    }

}
