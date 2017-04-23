'use babel';

import ServerView from './server-view.js';
import { $, ScrollView } from 'atom-space-pen-views';

const resizeCursor = process.platform === 'win32' ? 'ew-resize' : 'col-resize';

class TreeView extends ScrollView {
  TreeView() {
    super.TreeView();

    const self = this;
    self.servers = null;
  };

  static content() {
    return this.div({
      class: 'ftp-remote-edit-view ftp-remote-edit-resizer tool-panel',
      'data-show-on-right-side': atom.config.get('tree-view.showOnRightSide'),
    }, () => {
      this.div({
        class: 'ftp-remote-edit-scroller order--center',
        outlet: 'scroller',
      }, () => {
        this.ol({
          class: 'ftp-remote-edit-list full-menu list-tree has-collapsable-children focusable-panel',
          tabindex: -1,
          outlet: 'list',
        });
      });
      this.div({
        class: 'ftp-remote-edit-resize-handle',
        outlet: 'horizontalResize',
        style: `cursor:${resizeCursor}`, // platform specific cursor
      });
      this.div({
        class: 'info',
        tabindex: -1,
        outlet: 'info',
      });
    });
  };

  initialize(state) {
    super.initialize(state)

    const self = this;

    let html = '<ul>';
    html += '<li><a role="configure" class="btn btn-default icon">Edit Servers</a><br /></li>';
    html += '<li><a role="toggle" class="btn btn-default icon">Close Panel</a></li>';
    html += '</ul>';
    self.info.html(html);

    if (!self.servers) {
      self.showInfo();
    } else {
      self.hideInfo();
    }

    // Events
    atom.config.onDidChange('tree-view.showOnRightSide', () => {
      if (self.isVisible()) {
        setTimeout(() => {
          self.detach();
          self.attach();
        }, 1);
      }
    });

    // Info Panel
    self.info.on('click', '[role="configure"]', (e) => {
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:edit-servers');
    });
    self.info.on('click', '[role="toggle"]', (e) => {
      self.toggle();
    });

    // Resize Panel
    self.horizontalResize.on('dblclick', (e) => {
      self.resizeToFitContent(e);
    });
    self.horizontalResize.on('mousedown', (e) => {
      self.resizeHorizontalStarted(e);
    });

    // Keyboard Navigation
    self.list.on('keydown', (e) => { self.remoteKeyboardNavigation(e); });
  };

  reload() {
    const self = this;

    if (!self.servers) {
      self.showInfo();
      return;
    }

    self.hideInfo();
    self.servers.forEach((config) => {
      let server = new ServerView(config);
      self.list.append(server);
    });
  };

  attach() {
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
    super.detach()
    const destroyPanel = this.panel;
    this.panel = null;
    if (destroyPanel) {
      destroyPanel.destroy();
    }
  };

  toggle() {
    if (this.isVisible()) {
      this.detach();
    } else {
      this.attach();
    }
  };

  showInfo() {
    this.info.css('display', 'flex');
  };

  hideInfo() {
    this.info.hide();
  };

  getSelected() {
    const views = $('.ftp-remote-edit-view .selected')
      .map(function () {
        const v = $(this)
          .view();
        return v || null;
      })
      .get();

    return views;
  };

  deselect() {
    let selected = getSelected();
    selected.forEach((item) => {
      item.classList.remove('selected')
    });
  }

  resizeHorizontalStarted(e) {
    e.preventDefault();

    this.resizeWidthStart = this.width();
    this.resizeMouseStart = e.pageX;
    $(document)
      .on('mousemove', this.resizeHorizontalView.bind(this));
    $(document)
      .on('mouseup', this.resizeHorizontalStopped);
  };

  resizeHorizontalStopped() {
    delete this.resizeWidthStart;
    delete this.resizeMouseStart;
    $(document)
      .off('mousemove', this.resizeHorizontalView);
    $(document)
      .off('mouseup', this.resizeHorizontalStopped);
  };

  resizeHorizontalView(e) {
    if (e.which !== 1) {
      return this.resizeHorizontalStopped();
    }

    let delta = e.pageX - this.resizeMouseStart;
    let width = Math.max(50, this.resizeWidthStart - delta);

    this.width(width);
  };

  resizeToFitContent(e) {
    e.preventDefault();

    this.width(1);
    this.width(this.list.outerWidth() + 5);
  };

  remoteKeyboardNavigation(e) {
    let arrows = { left: 37, up: 38, right: 39, down: 40 },
      keyCode = e.keyCode || e.which;

    switch (keyCode) {
      case arrows.up:
        this.remoteKeyboardNavigationUp();
        break;
      case arrows.down:
        this.remoteKeyboardNavigationDown();
        break;
      case arrows.left:
        this.remoteKeyboardNavigationLeft();
        break;
      case arrows.right:
        this.remoteKeyboardNavigationRight();
        break;
      default:
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    this.remoteKeyboardNavigationMovePage();
  };

  remoteKeyboardNavigationUp() {
    let current = this.list.find('.selected'),
      next = current.prev('.entry:visible');
    if (next.length) {
      while (next.is('.expanded') && next.find('.entries .entry:visible')
        .length) {
        next = next.find('.entries .entry:visible');
      }
    } else {
      next = current.closest('.entries')
        .closest('.entry:visible');
    }
    if (next.length) {
      current.removeClass('selected');
      next.last()
        .addClass('selected');
    }
  };

  remoteKeyboardNavigationDown() {
    let current = this.list.find('.selected'),
      next = current.find('.entries .entry:visible');
    if (!next.length) {
      tmp = current;

      // Workaorund skip after 10
      let counter = 1;
      do {
        next = tmp.next('.entry:visible');
        if (!next.length) {
          tmp = tmp.closest('.entries')
            .closest('.entry:visible');
        }
        counter++;
      } while (!next.length && !tmp.is('.project-root') && counter<10);
    }
    if (next.length) {
      current.removeClass('selected');
      next.first()
        .addClass('selected');
    }
  };

  remoteKeyboardNavigationLeft() {
    const current = this.list.find('.selected');
    if (!current.is('.directory')) {
      next = current.closest('.directory');
      next.view()
        .collapse();
      current.removeClass('selected');
      next.first()
        .addClass('selected');
    } else {
      current.view()
        .collapse();
    }
  };

  remoteKeyboardNavigationRight() {
    const current = this.list.find('.selected');
    if (current.is('.directory')) {
      const view = current.view();
      view.expand();
    }
  };

  remoteKeyboardNavigationMovePage() {
    const current = this.list.find('.selected');
    if (current.length) {
      let scrollerTop = this.scroller.scrollTop(),
        selectedTop = current.position()
        .top;
      if (selectedTop < scrollerTop - 10) {
        this.scroller.pageUp();
      } else if (selectedTop > scrollerTop + this.scroller.height() - 10) {
        this.scroller.pageDown();
      }
    }
  };
}

module.exports = TreeView;
