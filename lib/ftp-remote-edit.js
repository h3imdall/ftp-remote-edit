'use babel';

import FtpRemoteEditView from './ftp-remote-edit-view';
import { CompositeDisposable } from 'atom';

import DirectoryView from './directory-view.js';
import FileView from './file-view.js';
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
    this.ftpRemoteEditView = new FtpRemoteEditView(state.ftpRemoteEditViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.ftpRemoteEditView,
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:toggle': () => this.toggle()
    }));

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:editconfiguration': () => this.editconfiguration()
    }));

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'ftp-remote-edit:closePanel': () => this.closePanel()
    }));

  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.ftpRemoteEditView.destroy();
  },

  serialize() {
    return {
      ftpRemoteEditViewState: this.ftpRemoteEditView.serialize()
    };
  },

  toggle() {
    this.modalPanel.getItem().setState('connectionview');
    return this.modalPanel.isVisible() ? this.modalPanel.hide() : this.modalPanel.show();
  },

  editconfiguration () {
    this.modalPanel.getItem().setState('editview');
    return this.modalPanel.isVisible() ? this.modalPanel.hide() : this.modalPanel.show();
  },

  closePanel () {

    let leftPanels = atom.workspace.getLeftPanels();
    leftPanels.forEach((item) => {
      if(item.getItem() instanceof Node) {
        item.destroy();
      }
    });

  }

};
