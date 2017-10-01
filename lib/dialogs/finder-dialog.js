'use babel';

import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
import path from 'path'
import {Disposable, CompositeDisposable} from 'atom'
import FileView from './../views/file-view.js';

export default class FinderDialog {
  constructor() {
    this.pattFile = (/^(\/)[\w\.]+$/);
    this.pattRootDir = (/^(\/)[^\/]+(\/)$/);
    this.previousQueryWasLineJump = false;
    this.items = [];
    this.selectListView = new SelectListView({
      items:this.items,
      filterKeyForItem: (item) => item.relativePath,
      filterQuery: (query) => {
        const colon = query.indexOf(':')
        if (colon !== -1) {
          query = query.slice(0, colon)
        }
        return query
      },
      didCancelSelection:() => { this.cancel(); },
      didConfirmSelection: (item) => {
        this.openFile(item.relativePath);
        this.cancel();
      },
      didChangeQuery:() => {
        const isLineJump = this.isQueryALineJump()
        if (!this.previousQueryWasLineJump && isLineJump) {
          this.previousQueryWasLineJump = true
          this.selectListView.update({
            items: [],
            emptyMessage: 'Jump to line in active editor'
          })
        } else if (this.previousQueryWasLineJump && !isLineJump) {
          this.previousQueryWasLineJump = false;
          this.selectListView.update({
            items: this.items
          })
        }
      },
      elementForItem: ({relativePath}) => {
        const filterQuery = this.selectListView.getFilterQuery();
        const matches = this.useAlternateScoring
          ? fuzzaldrin.match(relativePath, filterQuery)
          : fuzzaldrinPlus.match(relativePath, filterQuery);
        console.log(matches)

        const li = document.createElement('li');
        li.classList.add('two-lines');
        const fileBasename = path.basename(relativePath);
        const baseOffset = relativePath.length - fileBasename.length;
        const primaryLine = document.createElement('div');
        // primaryLine.classList.add('primary-line', 'file', 'icon', ...classList);
        primaryLine.classList.add('primary-line', 'file');
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
    this.selectListView.element.classList.add('remote-finder')
  }

  get element() {
    return this.selectListView.element;
  }

  show() {
    this.previouslyFocusedElement = document.activeElement;
    if (!this.panel) {
      this.panel = atom.workspace.addModalPanel({item: this});
    }
    this.panel.show();
    this.selectListView.focus();
  }

  hide() {
    if(this.panel) {
      this.panel.hide();
    }
    if(this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
      this.previouslyFocusedElement = null;
    }
  }

  destroy() {
    if (this.panel) {
      this.panel.destroy();
    }

    if (this.subscriptions) {
      this.subscriptions.dispose();
      this.subscriptions = null;
    }
    return this.selectListView.destroy();
  }

  cancel() {
    this.selectListView.reset();
    this.hide();
  }

  updateItems() {
     this.selectListView.update({
        items: this.items
      });
  }

  isQueryALineJump() {
    return (
      this.selectListView.getFilterQuery().trim() === '' &&
      this.selectListView.getQuery().indexOf(':') !== -1
    );
  }

  toggle(items, selected) {
    this.selected = selected;
    if (this.panel && this.panel.isVisible()) {
      this.cancel();
    } else {
      this.show();
      this.setItems(items);
    }
  }

  setItems(filePaths) {
    this.items = filePaths;
    if (this.isQueryALineJump()) {
      return this.selectListView.update({items: [], loadingMessage: null, loadingBadge: null});
    } else {
      return this.selectListView.update({items: this.items, loadingMessage: null, loadingBadge: null});
    }
  }

  openFile(relativePath) {
    if(!this.selected.view().find(relativePath)) {
      this.openDir(relativePath.replace(/[^\/]+$/, ''))
    }
    this.clickPath(relativePath)
  }

  openDir(dirPath) {
    if(this.pattRootDir.test(dirPath)) {
      this.selected.view().find(dirPath).click();
    } else if(!this.selected.view().find(dirPath)) {
      this.openDir(dirPath.replace(/[^\/]+\/$/, ''));
    }
  }

  clickPath(relativePath) {
    var element = this.selected.view().find(relativePath);
    if(!element) {
      setTimeout(()=>{
        this.selected.view().find(relativePath).click();
      }, 100)
    } else {
      element.click();
    }
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
