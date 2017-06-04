'use babel';

import path from 'path';
import { $, View, TextEditorView } from 'atom-space-pen-views';
import { TextBuffer } from 'atom';
import { checkPassword } from '../helper/secure.js';

const atom = global.atom;

export default class ChangePassDialog extends View {

  static content(opts) {
    const options = opts || {};
    return this.div({
      class: 'tree-view-dialog settings-view overlay from-top',
    }, () => {
      this.div({
        class: 'panels',
      }, () => {
        this.div({
          class: 'panels-item',
        }, () => {
          this.label({
            class: 'icon',
            outlet: 'text',
          });
          this.div({
            class: 'error-message',
            style: 'margin-bottom: 15px; color: #ff0000;',
            outlet: 'error',
          });
          this.div({
            class: 'panels-content',
            outlet: 'elements',
          });
        });
      });
    });
  }

  constructor(opts) {
    const options = opts || {};
    super(options);
    const self = this;

    self.mode = options.mode || 'change';
    self.title = options.title || 'Ftp-Remote-Edit';
    self.prompt = options.prompt || 'To change your password, you need to enter the old one and confirm the new one by entering it 2 times.';
    self.iconClass = options.iconClass || '';

    if (self.iconClass) {
      self.text.addClass(this.iconClass);
    }

    let html = '<p>' + self.title + '</p>';
    html += '<p>' + self.prompt + '</p>';
    self.text.html(html);

    let oldPwdLabel = document.createElement('label');
    oldPwdLabel.classList.add('control-label');
    let oldPwdLabelTitle = document.createElement('div');
    oldPwdLabelTitle.textContent = 'Old password:';
    oldPwdLabelTitle.classList.add('setting-title');
    oldPwdLabel.appendChild(oldPwdLabelTitle);
    self.oldPwdInput = new TextEditorView({ mini: true, placeholderText: "Enter old password..." });

    let newPwdLabel = document.createElement('label');
    newPwdLabel.classList.add('control-label');
    let newPwdLabelTitle = document.createElement('div');
    newPwdLabelTitle.textContent = 'New password:';
    newPwdLabelTitle.classList.add('setting-title');
    newPwdLabel.appendChild(newPwdLabelTitle);
    self.newPwdInput = new TextEditorView({ mini: true, placeholderText: "Enter new password..." });

    let confirmPwdLabel = document.createElement('label');
    confirmPwdLabel.classList.add('control-label');
    let confirmPwdLabelTitle = document.createElement('div');
    confirmPwdLabelTitle.textContent = 'Confirm password:';
    confirmPwdLabelTitle.classList.add('setting-title');
    confirmPwdLabel.appendChild(confirmPwdLabelTitle);
    self.confirmPwdInput = new TextEditorView({ mini: true, placeholderText: "Enter new password..." });

    let oldPwdControl = document.createElement('div');
    oldPwdControl.classList.add('controls');
    oldPwdControl.classList.add('oldPwd');
    oldPwdControl.appendChild(oldPwdLabel);
    oldPwdControl.appendChild(self.oldPwdInput.element);

    let newPwdControl = document.createElement('div');
    newPwdControl.classList.add('controls');
    newPwdControl.classList.add('newPwd');
    newPwdControl.appendChild(newPwdLabel);
    newPwdControl.appendChild(self.newPwdInput.element);

    let confirmPwdControl = document.createElement('div');
    confirmPwdControl.classList.add('controls');
    confirmPwdControl.classList.add('confirmPwd');
    confirmPwdControl.appendChild(confirmPwdLabel);
    confirmPwdControl.appendChild(self.confirmPwdInput.element);

    let pwdGroup = document.createElement('div');
    pwdGroup.classList.add('control-group');
    if (self.mode == 'change') pwdGroup.appendChild(oldPwdControl);
    pwdGroup.appendChild(newPwdControl);
    pwdGroup.appendChild(confirmPwdControl);

    let groups = document.createElement('div');
    groups.classList.add('control-groups');
    groups.appendChild(pwdGroup);

    let saveButton = document.createElement('button');
    saveButton.textContent = 'Apply';
    saveButton.classList.add('btn');

    let closeButton = document.createElement('button');
    closeButton.textContent = 'Cancel';
    closeButton.classList.add('btn');
    closeButton.classList.add('pull-right');

    self.elements.append(groups);
    self.elements.append(saveButton);
    self.elements.append(closeButton);

    const oldPasswordModel = self.oldPwdInput.getModel();
    const newPasswordModel = self.newPwdInput.getModel();
    const confirmPasswordModel = self.confirmPwdInput.getModel();

    let changing = false;
    oldPasswordModel.clearTextPassword = new TextBuffer('');
    oldPasswordModel.buffer.onDidChange((obj) => {
      if (!changing) {
        changing = true;
        oldPasswordModel.clearTextPassword.setTextInRange(obj.oldRange, obj.newText);
        oldPasswordModel.buffer.setTextInRange(obj.newRange, '*'.repeat(obj.newText.length));
        changing = false;
      }
    });

    newPasswordModel.clearTextPassword = new TextBuffer('');
    newPasswordModel.buffer.onDidChange((obj) => {
      if (!changing) {
        changing = true;
        newPasswordModel.clearTextPassword.setTextInRange(obj.oldRange, obj.newText);
        newPasswordModel.buffer.setTextInRange(obj.newRange, '*'.repeat(obj.newText.length));
        changing = false;
      }
    });

    confirmPasswordModel.clearTextPassword = new TextBuffer('');
    confirmPasswordModel.buffer.onDidChange((obj) => {
      if (!changing) {
        changing = true;
        confirmPasswordModel.clearTextPassword.setTextInRange(obj.oldRange, obj.newText);
        confirmPasswordModel.buffer.setTextInRange(obj.newRange, '*'.repeat(obj.newText.length));
        changing = false;
      }
    });

    // Events
    closeButton.addEventListener('click', (event) => {
      self.close();
    });

    saveButton.addEventListener('click', (event) => {
      self.save();
    });

    atom.commands.add(this.element, {
      'core:confirm': () => {
        self.save();
      },
      'core:cancel': () => {
        self.cancel();
      },
    });
  }

  attach() {
    const self = this;

    self.panel = atom.workspace.addModalPanel({
      item: this.element
    });

    if (self.mode == 'change') {
      self.oldPwdInput.focus();
      self.oldPwdInput.getModel()
        .scrollToCursorPosition();
    } else {
      self.newPwdInput.focus();
      self.newPwdInput.getModel()
        .scrollToCursorPosition();
    }
  }

  save() {
    const self = this;

    const oldPassword = self.oldPwdInput.getModel().clearTextPassword.getText();
    const newPassword = self.newPwdInput.getModel().clearTextPassword.getText();
    const confirmPassword = self.confirmPwdInput.getModel().clearTextPassword.getText();

    if (!checkPassword(oldPassword)) {
      return self.showError('Old password do not match.');
    }
    if (newPassword == '') {
      return self.showError('New password can not be empty.');
    }
    if (newPassword != confirmPassword) {
      return self.showError('New passwords do not match.');
    }

    let passwords = {
      'oldPassword': oldPassword,
      'newPassword': newPassword,
    }

    this.trigger('dialog-done', [passwords]);
    self.close();
  }

  close() {
    const destroyPanel = this.panel;
    this.panel = null;
    if (destroyPanel) {
      destroyPanel.destroy();
    }

    atom.workspace.getActivePane()
      .activate();
  }

  cancel() {
    this.close();
  }

  showError(message) {
    this.error.text(message);
    if (message) {
      this.flashError();
    }
  }
}
