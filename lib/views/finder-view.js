'use babel';

import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
import FileView from './file-view.js';
import { Disposable, CompositeDisposable } from 'atom'
import { getFullExtension, createLocalPath } from './../helper/helper.js';
import { highlight } from './../helper/format.js';

const Queue = require('./../helper/queue.js');
const Path = require('path');
const tempDirectory = require('os').tmpdir();
const FileSystem = require('fs-plus');

export default class FinderView {
  constructor() {
    const self = this;

    self.items = [];
    self.itemsCache = null;

    self.selectListView = new SelectListView({
      items: [],
      maxResults: 10,
      emptyMessage: 'No files found\u2026',
      filterKeyForItem: (item) => item.relativePath,
      didCancelSelection: () => { self.cancel(); },
      didConfirmSelection: (item) => {
        self.open(item);
        self.cancel();
      },
      elementForItem: ({ relativePath }) => {
        const filterQuery = self.selectListView.getFilterQuery();
        const matches = self.useAlternateScoring ?
          fuzzaldrin.match(relativePath, filterQuery) :
          fuzzaldrinPlus.match(relativePath, filterQuery);

        const li = document.createElement('li');
        const fileBasename = Path.basename(relativePath);
        const baseOffset = relativePath.length - fileBasename.length;
        const primaryLine = document.createElement('div');
        const secondaryLine = document.createElement('div');

        li.classList.add('two-lines');

        primaryLine.classList.add('primary-line', 'file', 'icon-file-text');
        primaryLine.dataset.name = fileBasename;
        primaryLine.dataset.path = relativePath;
        primaryLine.appendChild(highlight(fileBasename, matches, baseOffset));
        li.appendChild(primaryLine);

        secondaryLine.classList.add('secondary-line', 'path', 'no-icon');
        secondaryLine.appendChild(highlight(relativePath, matches, 0));
        li.appendChild(secondaryLine);

        return li;
      }
    });

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.config.observe('remote-finder.useAlternateScoring', (newValue) => {
        this.useAlternateScoring = newValue
        if (this.useAlternateScoring) {
          this.selectListView.update({
            filter: (items, query) => {
              return query ? fuzzaldrinPlus.filter(items, query, { key: 'relativePath' }) : items
            }
          })
        } else {
          this.selectListView.update({ filter: null })
        }
      })
    );
  }

  get element() {
    const self = this;

    return self.selectListView.element;
  }

  show() {
    const self = this;

    self.previouslyFocusedElement = document.activeElement;
    if (!self.panel) {
      self.panel = atom.workspace.addModalPanel({ item: self });
    }
    self.panel.show();
    self.selectListView.focus();
  }

  hide() {
    const self = this;

    if (self.panel) {
      self.panel.hide();
    }
    if (self.previouslyFocusedElement) {
      self.previouslyFocusedElement.focus();
      self.previouslyFocusedElement = null;
    }
  }

  cancel() {
    const self = this;

    self.selectListView.reset();
    self.hide();
  }

  toggle() {
    const self = this;

    if (self.panel && self.panel.isVisible()) {
      self.cancel();
    } else{
      self.show();
    }
  }

  destroy() {
    const self = this;

    if (self.panel) {
      self.panel.destroy();
    }

    if (self.subscriptions) {
      self.subscriptions.dispose();
      self.subscriptions = null;
    }
    return self.selectListView.destroy();
  }

  open(item) {
    const self = this;
    let relativePath = item.relativePath;
    let size = item.size;
    let root = self.itemsCache.getRoot();
    let localPath = (tempDirectory + '/' + root.config.host + '/' + root.config.remote + '/' +
      relativePath).replace(/\/+/g, Path.sep);
    let remotePath = root.config.remote + '/' + relativePath;
    if (self.getTextEditor(localPath)) {
      atom.workspace.open(localPath, { pending: true, searchAllPanes: true })
      return false;
    }

    // Check if file is already in Queue
    if (!Queue.existsFile(localPath)) {
      // Add to Download Queue
      queueItem = Queue.addFile({
        direction: "download",
        remotePath: remotePath,
        localPath: localPath,
        size: size
      });
    } else {
      return false;
    }

    createLocalPath(localPath);
    root
      .connector.downloadFile(queueItem)
      .then(() => {
        // Open file in texteditor
        return atom.workspace.open(localPath, { pending: true, searchAllPanes: true })
          .then((editor) => {
            try {
              editor.onDidSave((saveObject) => {
                FileSystem.stat(localPath, function (err, stats) {
                  if (stats) {
                    item.size = stats.size;
                  }
                });
                // Add to Upload Queue
                let queueItem = Queue.addFile({
                  direction: "upload",
                  remotePath: remotePath,
                  localPath: localPath,
                  size: item.size
                });

                root.connector.uploadFile(editor.getText(), queueItem)
                  .then(() => {
                    if (atom.config.get('ftp-remote-edit.notifications.showNotificationOnUpload')) {
                      root.connector.showMessage('File successfully uploaded.', 'success');
                    }
                  })
                  .catch(function (err) {
                    queueItem.changeStatus('Error');
                    root.connector.showMessage(err.message, 'error');
                  });
              })

              editor.onDidDestroy(() => {
                editor = null;
              });
            } catch (err) {}
          })
          .catch(function (err) {
            root.connector.showMessage(err.message, 'error');
          });
      })
      .catch(function (err) {
        queueItem.changeStatus('Error');
        root.connector.showMessage(err, 'error');
      });
  }

  getTextEditor(pathOnFileSystem, activate = false) {
    let foundEditor = null;
    texteditors = atom.workspace.getTextEditors();
    texteditors.forEach((texteditor) => {
      if (texteditor.getPath() == pathOnFileSystem) {
        foundEditor = texteditor;
        return false;
      }
    });

    if (activate && foundEditor) {
      pane = atom.workspace.paneForItem(foundEditor);
      if (pane) pane.activateItem(foundEditor);
    }

    return foundEditor;
  }

}
