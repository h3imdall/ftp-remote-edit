'use babel';

import FtpRemoteEditView from './ftp-remote-edit-view';
import { CompositeDisposable } from 'atom';

import DirectoryView from './directory-view.js';
import FileView from './file-view.js';
import MessageView from './message-view.js';
import ListView from './list-view.js';
import Node from './Node.js';
import Ftp from './Ftp.js';

var FileSystem = require('fs');

export default {

  config: {
    config: {
      title: 'Encrypted Connection Configuration',
      description: 'This is the encrypted Connection Information about your Servers. Don\'t edit this!',
      type: 'string',
      default: ''
    },
    password: {
      type: 'string',
      default: ''
    },
    reset: {
      type: 'boolean',
      default: true
    }
  },

  ftpRemoteEditView: null,
  modalPanel: null,
  subscriptions: null,
  ftpPanel: null,

  activate(state) {

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:toggle': () => this.toggle()
    }));

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:editconfiguration': () => this.editconfiguration()
    }));
  
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:closePanel': () => this.closePanel()
    }));
  
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:newFile': () => this.newFile(state)
    }));
  
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:newDirectory': () => this.newDirectory(state)
    }));
  
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:delete': () => this.delete()
    }));

  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.ftpRemoteEditView.destroy();
  },

  serialize() {
    return {
    };
  },

  toggle() {

    if(atom.config.get('ftp-remote-edit.reset') === true) {
      let messageView = new MessageView('Before you can show the panel, edit the connection configuration.');
    } else {
      this.ftpRemoteEditView = new FtpRemoteEditView();
      this.modalPanel = atom.workspace.addModalPanel({
        item: this.ftpRemoteEditView,
      });
      this.ftpRemoteEditView.setPanel(this.modalPanel);
      this.modalPanel.getItem().setState('connectionview');
    }


    return true;
  },

  editconfiguration () {

    this.ftpRemoteEditView = new FtpRemoteEditView();
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.ftpRemoteEditView,
    });
    this.ftpRemoteEditView.setPanel(this.modalPanel);


    this.modalPanel.getItem().setState('editview');
    return true;
  },

  closePanel () {

    let leftPanels = atom.workspace.getLeftPanels();
    leftPanels.forEach((item) => {
      if(item.getItem() instanceof Node) {
        item.destroy();
      }
    });

  },

  newFile (state) {
    console.log(state);
  },

  newDirectory (state) {
    console.log(atom.workspace.getActivePane());
    console.log(atom.workspace.getActivePane().getActiveItem());

  },

  delete () {
    console.log(event);

  }

};
