'use babel';

import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
import path from 'path'
import {Disposable, CompositeDisposable} from 'atom'
import FileView from './file-view.js';

const Queue = require('./../helper/queue.js');

export default class FinderView {
  constructor() {
    const self = this;

    self.pattFile = (/^(\/)[\w\.]+$/);
    self.pattRootDir = (/^(\/)[^\/]+(\/)$/);
    self.previousQueryWasLineJump = false;
    self.items = [];
    //self.itemsCache = [];
    self.selectListView = new SelectListView({
      items:[],
      filterKeyForItem: (item) => item.relativePath,
      filterQuery: (query) => {
        const colon = query.indexOf(':')
        if (colon !== -1) {
          query = query.slice(0, colon)
        }
        return query
      },
      didCancelSelection:() => { self.cancel(); },
      didConfirmSelection: (item) => {
        self.open(item.relativePath);
        self.cancel;
      },
      didChangeQuery:() => {
        const isLineJump = self.isQueryALineJump()
        if (!self.previousQueryWasLineJump && isLineJump) {
          self.previousQueryWasLineJump = true
          self.selectListView.update({
            items: [],
            emptyMessage: 'Jump to line in active editor'
          })
        } else if (self.previousQueryWasLineJump && !isLineJump) {
          self.previousQueryWasLineJump = false;
          self.selectListView.update({
            items: self.items
          })
        }
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
    self.selectListView.element.classList.add('remote-finder')
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

  isQueryALineJump() {
    const self = this;
    return (
      self.selectListView.getFilterQuery().trim() === '' &&
      self.selectListView.getQuery().indexOf(':') !== -1
    );
  }

  toggle(selected) {
    const self = this;
    self.selected = selected;
    let root = null;
    root = selected.view().getRoot();
    root.connector.listRemotePaths(root.config.remote + '/')
    .then((result) => {
      self.items= result;
      if(self.panel && self.panel.isVisible()) {
        self.cancel();
      } else {
        self.show();
        self.setItems(self.items);
      }
    });
  }

  setItems(filePaths) {
    const self = this;
    self.items = filePaths;
    if (self.isQueryALineJump()) {
      return self.selectListView.update({items: [], loadingMessage: null, loadingBadge: null});
    } else {
      return self.selectListView.update({items: self.items, loadingMessage: null, loadingBadge: null});
    }
  }

  open(relativePath) {
    const self = this;
    let root = self.selected.view().getRoot()
    root.expandPath(relativePath, true)
          .then(() => {
            self.selected.view().find(relativePath).click();
          })
          .catch(function (err) {
            root.connector.showMessage(err, 'error');
          });

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
