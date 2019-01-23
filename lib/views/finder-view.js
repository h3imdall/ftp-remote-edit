'use babel';

import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
import { CompositeDisposable } from 'atom'
import { highlight } from './../helper/helper.js';

const EventEmitter = require('events');
const Path = require('path');

export default class FinderView extends EventEmitter {

  constructor() {
    super();
    const self = this;

    self.subscriptions = null;
    self.items = [];
    self.itemsCache = null;
    self.root = null;

    self.selectListView = new SelectListView({
      items: [],
      maxResults: 25,
      emptyMessage: 'No files found\u2026',
      filterKeyForItem: (item) => {
        if (atom.config.get('ftp-remote-edit.finder.filterKeyForItem') == "Filename") {
          return item.file;
        } else {
          return item.relativePath;
        }
      },
      didCancelSelection: () => { self.cancel(); },
      didConfirmSelection: (item) => {
        self.open(item);
        self.cancel();
      },
      elementForItem: ({ file, relativePath }) => {
        let key = null;
        if (atom.config.get('ftp-remote-edit.finder.filterKeyForItem') == "Filename") {
          key = file;
        } else {
          key = relativePath;
        }
        const filterQuery = self.selectListView.getFilterQuery();
        const matches = self.useAlternateScoring ? fuzzaldrin.match(key, filterQuery) : fuzzaldrinPlus.match(key, filterQuery);
        const li = document.createElement('li');
        const fileBasename = Path.basename(relativePath);
        const baseOffset = relativePath.length - fileBasename.length;
        const primaryLine = document.createElement('div');
        const secondaryLine = document.createElement('div');

        li.classList.add('two-lines');

        primaryLine.classList.add('primary-line', 'file', 'icon-file-text');
        primaryLine.dataset.name = fileBasename;
        primaryLine.dataset.path = relativePath;
        if (atom.config.get('ftp-remote-edit.finder.filterKeyForItem') == "Filename") {
          primaryLine.appendChild(highlight(key, matches, 0));
        } else {
          primaryLine.appendChild(highlight(fileBasename, matches, baseOffset));
        }
        li.appendChild(primaryLine);

        secondaryLine.classList.add('secondary-line', 'path', 'no-icon');
        if (atom.config.get('ftp-remote-edit.finder.filterKeyForItem') == "Filename") {
          let fragment = highlight(key, matches, 0)
          let beforefragment = document.createTextNode(relativePath.replace(fileBasename, ""));
          secondaryLine.appendChild(beforefragment);
          secondaryLine.appendChild(fragment);
        } else {
          secondaryLine.appendChild(highlight(key, matches, 0));
        }
        li.appendChild(secondaryLine);

        return li;
      },
      order: (item1, item2) => {
        return item1.relativePath.length - item2.relativePath.length;
      }
    });

    // Add class to use stylesheets from this package
    self.selectListView.element.classList.add('remote-finder');

    self.subscriptions = new CompositeDisposable();
    self.subscriptions.add(
      atom.config.observe('remote-finder.useAlternateScoring', (newValue) => {
        this.useAlternateScoring = newValue
        if (this.useAlternateScoring) {
          this.selectListView.update({
            filter: (items, query) => {
              return query ? fuzzaldrinPlus.filter(items, query, { key: atom.config.get('ftp-remote-edit.finder.filterKeyForItem') }) : items
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
    self.emit('ftp-remote-edit-finder:show');
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
    self.emit('ftp-remote-edit-finder:hide');
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
    } else {
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

    self.emit('ftp-remote-edit-finder:open', item);
  }
}
