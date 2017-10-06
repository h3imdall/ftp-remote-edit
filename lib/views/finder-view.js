'use babel';

import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
import path from 'path'
import {Disposable, CompositeDisposable} from 'atom'
import FileView from './file-view.js';
import { getFullExtension, createLocalPath } from './../helper/helper.js';

const Queue = require('./../helper/queue.js');
const Path = require('path');
const tempDirectory = require('os').tmpdir();
const FileSystem = require('fs-plus');

export default class FinderView {
  constructor() {
    const self = this;

    self.items = [];
    self.selectListView = new SelectListView({
      items:[],
      maxResults: 10,
      loadingMessage:'loading...',
      filterKeyForItem: (item) => item.relativePath,
      filterQuery: (query) => {
        const colon = query.indexOf(':')
        if (colon !== -1) {
          query = query.slice(0, colon)
        }
        return query;
      },
      didCancelSelection:() => { self.cancel(); },
      didConfirmSelection: (item) => {
        self.open(item);
        self.cancel();
      },
      didChangeQuery:() => {
        self.selectListView.update({
          items: self.items
        });
      },
      elementForItem: ({relativePath}) => {
        const filterQuery = self.selectListView.getFilterQuery();
        const matches = self.useAlternateScoring
          ? fuzzaldrin.match(relativePath, filterQuery)
          : fuzzaldrinPlus.match(relativePath, filterQuery);

        const li = document.createElement('li');
        li.classList.add('two-lines');
        const fileBasename = path.basename(relativePath);
        const baseOffset = relativePath.length - fileBasename.length;
        const primaryLine = document.createElement('div');
        primaryLine.classList.add('primary-line', 'file', 'icon-file-text');
        primaryLine.dataset.name = fileBasename;
        primaryLine.dataset.path = relativePath;
        primaryLine.appendChild(highlight(fileBasename, matches, baseOffset));
        li.appendChild(primaryLine);

        const secondaryLine = document.createElement('div');
        secondaryLine.classList.add('secondary-line', 'path', 'no-icon');
        secondaryLine.appendChild(highlight(relativePath, matches, 0));
        li.appendChild(secondaryLine);
        return li;
      }
    });
    self.selectListView.element.classList.add('remote-finder');

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.config.observe('remote-finder.useAlternateScoring', (newValue) => {
        this.useAlternateScoring = newValue
        if (this.useAlternateScoring) {
          this.selectListView.update({
            filter: (items, query) => {
              return query ? fuzzaldrinPlus.filter(items, query, {key: 'relativePath'}) : items
            }
          })
        } else {
          this.selectListView.update({filter: null})
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
      self.panel = atom.workspace.addModalPanel({item: self});
    }
    self.panel.show();
    self.selectListView.focus();
  }

  hide() {
    const self = this;
    if(self.panel) {
      self.panel.hide();
    }
    if(self.previouslyFocusedElement) {
      self.previouslyFocusedElement.focus();
      self.previouslyFocusedElement = null;
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

  cancel() {
    const self = this;
    self.selectListView.reset();
    self.hide();
  }

  updateItems() {
    const self = this;
     self.selectListView.update({
        items: self.items
      });
  }

  toggle(selected) {
    const self = this;
    self.selected = selected;
    let root = null;
    root = selected.view().getRoot();
    if(self.panel && self.panel.isVisible()) {
      self.cancel();
      return;
    }
    self.show();
    if(!selected.view().finderItemsCache) {
      root.connector.listRemotePaths(root.config.remote + '/')
      .then((result) => {
        selected.view().finderItemsCache = result;
        self.items= result;
        self.setItems();
      });
    } else {
        self.items = selected.view().finderItemsCache;
        self.setItems();
      }
  }

  setItems() {
    const self = this;
    return self.selectListView.update({items: self.items, loadingMessage: null, loadingBadge: null});
  }

  open(item) {
    const self = this;
    let relativePath = item.relativePath;
    let size = item.size;
    let root = self.selected.view().getRoot();
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
        size:size
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
            editor.onDidSave((saveObject) =>{
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
          } catch(err) {}
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

function highlight (path, matches, offsetIndex) {
  let lastIndex = 0;
  let matchedChars = [];
  const fragment = document.createDocumentFragment();
  for (let matchIndex of matches) {
    matchIndex -= offsetIndex;
    // If marking up the basename, omit path matches
    if (matchIndex < 0) {
      continue;
    }
    const unmatched = path.substring(lastIndex, matchIndex);
    if (unmatched) {
      if (matchedChars.length > 0) {
        const span = document.createElement('span');
        span.classList.add('character-match');
        span.textContent = matchedChars.join('');
        fragment.appendChild(span);
        matchedChars = [];
      }

      fragment.appendChild(document.createTextNode(unmatched))
    }

    matchedChars.push(path[matchIndex]);
    lastIndex = matchIndex + 1;
  }

  if (matchedChars.length > 0) {
    const span = document.createElement('span');
    span.classList.add('character-match');
    span.textContent = matchedChars.join('');
    fragment.appendChild(span);
  }

  // Remaining characters are plain text
  fragment.appendChild(document.createTextNode(path.substring(lastIndex)));
  return fragment;
}
