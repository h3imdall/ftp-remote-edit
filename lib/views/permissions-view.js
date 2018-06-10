'use babel';

import path from 'path';
import { $, ScrollView, TextEditorView } from 'atom-space-pen-views';
import { TextBuffer } from 'atom';
import { rightsToPermissions, permissionsToRights } from './../helper/format.js';

export default class PermissionsView extends ScrollView {

  static content() {
    return this.div({
      class: 'ftp-remote-edit permissions-view overlay from-top',
    }, () => {
      this.div({
        class: 'panels',
      }, () => {
        this.div({
          class: 'panels-item',
        }, () => {
          this.label({
            class: 'icon',
            outlet: 'info',
          });
          this.div({
            class: 'panels-content',
            outlet: 'elements',
          });
        });
      });
    });
  }

  constructor(item) {
    super();

    const self = this;

    if (!item) return;

    self.disableEventhandler = false;
    self.item = item;
    self.rights = (item.rights) ? item.rights : { user: '', group: '', other: '' };

    if (self.item.is('.directory')) {
      self.isFile = false;
    } else {
      self.isFile = true;
    }

    let html = '<p>Change ' + ((self.isFile) ? 'file' : 'directory') + ' attributes</p>';
    html += '<p>Please select the new attributes for the ' + ((self.isFile) ? 'file' : 'directory') + ' "' + self.item.name + '".</p>';
    self.info.html(html);

    self.saveButton = document.createElement('button');
    self.saveButton.textContent = 'Save';
    self.saveButton.classList.add('btn');

    self.closeButton = document.createElement('button');
    self.closeButton.textContent = 'Cancel';
    self.closeButton.classList.add('btn');
    self.closeButton.classList.add('pull-right');

    self.elements.append(self.createPanelContent());

    self.elements.append(self.saveButton);
    self.elements.append(self.closeButton);

    // Events
    self.closeButton.addEventListener('click', (event) => {
      self.close();
    });

    self.saveButton.addEventListener('click', (event) => {
      self.save();
    });

    atom.commands.add(this.element, {
      'core:confirm': () => {
        // self.save();
      },
      'core:cancel': () => {
        self.cancel();
      },
    });
  }

  createPanelContent() {
    const self = this;

    let content = document.createElement('div');

    content.appendChild(self.createOwnerFieldset());
    content.appendChild(self.createGroupFieldset());
    content.appendChild(self.createOtherFieldset());

    let numericGroup = document.createElement('div');
    numericGroup.classList.add('control-group');
    numericGroup.style.marginBottom = '20px';

    let numericGroupControls = document.createElement('div');
    numericGroupControls.classList.add('controls');
    numericGroup.appendChild(numericGroupControls);

    let numericLabel = document.createElement('label');
    numericLabel.classList.add('control-label');
    let numericLabelTitle = document.createElement('div');
    numericLabelTitle.textContent = `Numeric value`;
    numericLabelTitle.classList.add('setting-title');
    numericLabel.appendChild(numericLabelTitle);
    numericGroup.appendChild(numericLabel);

    self.numericInput = new TextEditorView({ mini: true })
    numericGroup.appendChild(self.numericInput.element);

    let infoLabel = document.createElement('p');
    infoLabel.textContent = 'You can use an x at any position to keep the permission the original ' + ((self.isFile) ? 'file' : 'directory') + ' have.';
    numericGroup.appendChild(infoLabel);

    content.appendChild(numericGroup);

    // Events
    self.numericInput.getModel().buffer.onDidChange((obj) => {
      let allowed = ['x', '0', '1', '2', '3', '4', '5', '6', '7'];

      if (self.disableEventhandler) return;

      if (obj.newRange.end.column < obj.oldRange.end.column) {
        self.updateCheckboxInputs();
        return;
      }

      if (obj.newRange.end.column > 3) {
        self.numericInput.getModel().buffer.setTextInRange(obj.newRange, '');
        return;
      }

      obj.changes.forEach(function (change) {
        change.newText.split('').forEach(function (value) {
          if (allowed.indexOf(value) == -1) {
            self.numericInput.getModel().buffer.setTextInRange(obj.newRange, '');
          }
        });
      });

      self.updateCheckboxInputs();
    });

    return content;
  }

  createOwnerFieldset() {
    const self = this;

    let ownerGroup = document.createElement('div');
    ownerGroup.classList.add('control-group');
    ownerGroup.style.marginBottom = '20px';

    let ownerGroupLabel = document.createElement('label');
    ownerGroupLabel.classList.add('control-group-label');
    ownerGroupLabel.textContent = 'Owner permissions';
    ownerGroup.appendChild(ownerGroupLabel);

    let ownerGroupControl = document.createElement('div');
    ownerGroupControl.classList.add('controls');
    ownerGroupControl.classList.add('owner');
    ownerGroupControl.classList.add('checkbox');
    ownerGroup.appendChild(ownerGroupControl);

    let ownerGroupReadInputLabel = document.createElement('label');
    ownerGroupReadInputLabel.classList.add('control');
    ownerGroupControl.appendChild(ownerGroupReadInputLabel);

    self.ownerGroupReadInput = document.createElement('input');
    self.ownerGroupReadInput.type = 'checkbox';
    self.ownerGroupReadInput.checked = false;
    self.ownerGroupReadInput.classList.add('input-checkbox');
    let ownerGroupReadInputTitle = document.createElement('div');
    ownerGroupReadInputTitle.classList.add('input-title')
    ownerGroupReadInputTitle.textContent = 'Read';
    ownerGroupReadInputLabel.appendChild(self.ownerGroupReadInput);
    ownerGroupReadInputLabel.appendChild(ownerGroupReadInputTitle);

    let ownerGroupWriteInputLabel = document.createElement('label');
    ownerGroupWriteInputLabel.classList.add('control');
    ownerGroupControl.appendChild(ownerGroupWriteInputLabel);

    self.ownerGroupWriteInput = document.createElement('input');
    self.ownerGroupWriteInput.type = 'checkbox';
    self.ownerGroupWriteInput.checked = false;
    self.ownerGroupWriteInput.classList.add('input-checkbox');
    let ownerGroupWriteInputTitle = document.createElement('div');
    ownerGroupWriteInputTitle.classList.add('input-title')
    ownerGroupWriteInputTitle.textContent = 'Write';
    ownerGroupWriteInputLabel.appendChild(self.ownerGroupWriteInput);
    ownerGroupWriteInputLabel.appendChild(ownerGroupWriteInputTitle);

    let ownerGroupExecuteInputLabel = document.createElement('label');
    ownerGroupExecuteInputLabel.classList.add('control');
    ownerGroupControl.appendChild(ownerGroupExecuteInputLabel);

    self.ownerGroupExecuteInput = document.createElement('input');
    self.ownerGroupExecuteInput.type = 'checkbox';
    self.ownerGroupExecuteInput.checked = false;
    self.ownerGroupExecuteInput.classList.add('input-checkbox');
    let ownerGroupExecuteInputTitle = document.createElement('div');
    ownerGroupExecuteInputTitle.classList.add('input-title')
    ownerGroupExecuteInputTitle.textContent = 'Execute';
    ownerGroupExecuteInputLabel.appendChild(self.ownerGroupExecuteInput);
    ownerGroupExecuteInputLabel.appendChild(ownerGroupExecuteInputTitle);

    // Events
    self.ownerGroupReadInput.addEventListener('change', (event) => {
      if (self.disableEventhandler) return;
      self.updateNumericInput();
    });

    self.ownerGroupWriteInput.addEventListener('change', (event) => {
      if (self.disableEventhandler) return;
      self.updateNumericInput();
    });

    self.ownerGroupExecuteInput.addEventListener('change', (event) => {
      if (self.disableEventhandler) return;
      self.updateNumericInput();
    });

    return ownerGroup;
  }

  createGroupFieldset() {
    const self = this;

    let groupGroup = document.createElement('div');
    groupGroup.classList.add('control-group');
    groupGroup.style.marginBottom = '20px';

    let groupGroupLabel = document.createElement('label');
    groupGroupLabel.classList.add('control-group-label');
    groupGroupLabel.textContent = 'Group permissions';
    groupGroup.appendChild(groupGroupLabel);

    let groupGroupControl = document.createElement('div');
    groupGroupControl.classList.add('controls');
    groupGroupControl.classList.add('group');
    groupGroupControl.classList.add('checkbox');
    groupGroup.appendChild(groupGroupControl);

    let groupGroupReadInputLabel = document.createElement('label');
    groupGroupReadInputLabel.classList.add('control');
    groupGroupControl.appendChild(groupGroupReadInputLabel);

    self.groupGroupReadInput = document.createElement('input');
    self.groupGroupReadInput.type = 'checkbox';
    self.groupGroupReadInput.checked = false;
    self.groupGroupReadInput.classList.add('input-checkbox');
    let groupGroupReadInputTitle = document.createElement('div');
    groupGroupReadInputTitle.classList.add('input-title')
    groupGroupReadInputTitle.textContent = 'Read';
    groupGroupReadInputLabel.appendChild(self.groupGroupReadInput);
    groupGroupReadInputLabel.appendChild(groupGroupReadInputTitle);

    let groupGroupWriteInputLabel = document.createElement('label');
    groupGroupWriteInputLabel.classList.add('control');
    groupGroupControl.appendChild(groupGroupWriteInputLabel);

    self.groupGroupWriteInput = document.createElement('input');
    self.groupGroupWriteInput.type = 'checkbox';
    self.groupGroupWriteInput.checked = false;
    self.groupGroupWriteInput.classList.add('input-checkbox');
    let groupGroupWriteInputTitle = document.createElement('div');
    groupGroupWriteInputTitle.classList.add('input-title')
    groupGroupWriteInputTitle.textContent = 'Write';
    groupGroupWriteInputLabel.appendChild(self.groupGroupWriteInput);
    groupGroupWriteInputLabel.appendChild(groupGroupWriteInputTitle);

    let groupGroupExecuteInputLabel = document.createElement('label');
    groupGroupExecuteInputLabel.classList.add('control');
    groupGroupControl.appendChild(groupGroupExecuteInputLabel);

    self.groupGroupExecuteInput = document.createElement('input');
    self.groupGroupExecuteInput.type = 'checkbox';
    self.groupGroupExecuteInput.checked = false;
    self.groupGroupExecuteInput.classList.add('input-checkbox');
    let groupGroupExecuteInputTitle = document.createElement('div');
    groupGroupExecuteInputTitle.classList.add('input-title')
    groupGroupExecuteInputTitle.textContent = 'Execute';
    groupGroupExecuteInputLabel.appendChild(self.groupGroupExecuteInput);
    groupGroupExecuteInputLabel.appendChild(groupGroupExecuteInputTitle);

    // Events
    self.groupGroupReadInput.addEventListener('change', (event) => {
      if (self.disableEventhandler) return;
      self.updateNumericInput();
    });

    self.groupGroupWriteInput.addEventListener('change', (event) => {
      if (self.disableEventhandler) return;
      self.updateNumericInput();
    });

    self.groupGroupExecuteInput.addEventListener('change', (event) => {
      if (self.disableEventhandler) return;
      self.updateNumericInput();
    });

    return groupGroup;
  }

  createOtherFieldset() {
    const self = this;

    let otherGroup = document.createElement('div');
    otherGroup.classList.add('control-group');
    otherGroup.style.marginBottom = '20px';

    let otherGroupLabel = document.createElement('label');
    otherGroupLabel.classList.add('control-group-label');
    otherGroupLabel.textContent = 'Public permissions';
    otherGroup.appendChild(otherGroupLabel);

    let otherGroupControl = document.createElement('div');
    otherGroupControl.classList.add('controls');
    otherGroupControl.classList.add('other');
    otherGroupControl.classList.add('checkbox');
    otherGroup.appendChild(otherGroupControl);

    let otherGroupReadInputLabel = document.createElement('label');
    otherGroupReadInputLabel.classList.add('control');
    otherGroupControl.appendChild(otherGroupReadInputLabel);

    self.otherGroupReadInput = document.createElement('input');
    self.otherGroupReadInput.type = 'checkbox';
    self.otherGroupReadInput.checked = false;
    self.otherGroupReadInput.classList.add('input-checkbox');
    let otherGroupReadInputTitle = document.createElement('div');
    otherGroupReadInputTitle.classList.add('input-title')
    otherGroupReadInputTitle.textContent = 'Read';
    otherGroupReadInputLabel.appendChild(self.otherGroupReadInput);
    otherGroupReadInputLabel.appendChild(otherGroupReadInputTitle);

    let otherGroupWriteInputLabel = document.createElement('label');
    otherGroupWriteInputLabel.classList.add('control');
    otherGroupControl.appendChild(otherGroupWriteInputLabel);

    self.otherGroupWriteInput = document.createElement('input');
    self.otherGroupWriteInput.type = 'checkbox';
    self.otherGroupWriteInput.checked = false;
    self.otherGroupWriteInput.classList.add('input-checkbox');
    let otherGroupWriteInputTitle = document.createElement('div');
    otherGroupWriteInputTitle.classList.add('input-title')
    otherGroupWriteInputTitle.textContent = 'Write';
    otherGroupWriteInputLabel.appendChild(self.otherGroupWriteInput);
    otherGroupWriteInputLabel.appendChild(otherGroupWriteInputTitle);

    let otherGroupExecuteInputLabel = document.createElement('label');
    otherGroupExecuteInputLabel.classList.add('control');
    otherGroupControl.appendChild(otherGroupExecuteInputLabel);

    self.otherGroupExecuteInput = document.createElement('input');
    self.otherGroupExecuteInput.type = 'checkbox';
    self.otherGroupExecuteInput.checked = false;
    self.otherGroupExecuteInput.classList.add('input-checkbox');
    let otherGroupExecuteInputTitle = document.createElement('div');
    otherGroupExecuteInputTitle.classList.add('input-title')
    otherGroupExecuteInputTitle.textContent = 'Execute';
    otherGroupExecuteInputLabel.appendChild(self.otherGroupExecuteInput);
    otherGroupExecuteInputLabel.appendChild(otherGroupExecuteInputTitle);

    // Events
    self.otherGroupReadInput.addEventListener('change', (event) => {
      if (self.disableEventhandler) return;
      self.updateNumericInput();
    });

    self.otherGroupWriteInput.addEventListener('change', (event) => {
      if (self.disableEventhandler) return;
      self.updateNumericInput();
    });

    self.otherGroupExecuteInput.addEventListener('change', (event) => {
      if (self.disableEventhandler) return;
      self.updateNumericInput();
    });

    return otherGroup;
  }

  enableFieldset(group) {
    const self = this;

    if (group == 'owner') {
      self.ownerGroupReadInput.removeAttribute("disabled");
      self.ownerGroupWriteInput.removeAttribute("disabled");
      self.ownerGroupExecuteInput.removeAttribute("disabled");
    }

    if (group == 'group') {
      self.groupGroupReadInput.removeAttribute("disabled");
      self.groupGroupWriteInput.removeAttribute("disabled");
      self.groupGroupExecuteInput.removeAttribute("disabled");
    }

    if (group == 'other') {
      self.otherGroupReadInput.removeAttribute("disabled");
      self.otherGroupWriteInput.removeAttribute("disabled");
      self.otherGroupExecuteInput.removeAttribute("disabled");
    }
  }

  disableFieldset(group) {
    const self = this;

    if (group == 'owner') {
      self.ownerGroupReadInput.setAttribute("disabled", true);
      self.ownerGroupWriteInput.setAttribute("disabled", true);
      self.ownerGroupExecuteInput.setAttribute("disabled", true);
    }

    if (group == 'group') {
      self.groupGroupReadInput.setAttribute("disabled", true);
      self.groupGroupWriteInput.setAttribute("disabled", true);
      self.groupGroupExecuteInput.setAttribute("disabled", true);
    }

    if (group == 'other') {
      self.otherGroupReadInput.setAttribute("disabled", true);
      self.otherGroupWriteInput.setAttribute("disabled", true);
      self.otherGroupExecuteInput.setAttribute("disabled", true);
    }
  }

  setCheckboxInputs(rights) {
    const self = this;

    let user = rights.user.split('');
    let group = rights.group.split('');
    let other = rights.other.split('');

    let permissionsuser = 0;
    let permissionsgroup = 0;
    let permissionsother = 0;

    self.ownerGroupReadInput.checked = false;
    self.ownerGroupWriteInput.checked = false;
    self.ownerGroupExecuteInput.checked = false;
    self.groupGroupReadInput.checked = false;
    self.groupGroupWriteInput.checked = false;
    self.groupGroupExecuteInput.checked = false;
    self.otherGroupReadInput.checked = false;
    self.otherGroupWriteInput.checked = false;
    self.otherGroupExecuteInput.checked = false;

    user.forEach(function (right) {
      if (right == 'r') self.ownerGroupReadInput.checked = true;
      if (right == 'w') self.ownerGroupWriteInput.checked = true;
      if (right == 'x') self.ownerGroupExecuteInput.checked = true;
    });

    group.forEach(function (right) {
      if (right == 'r') self.groupGroupReadInput.checked = true;
      if (right == 'w') self.groupGroupWriteInput.checked = true;
      if (right == 'x') self.groupGroupExecuteInput.checked = true;
    });

    other.forEach(function (right) {
      if (right == 'r') self.otherGroupReadInput.checked = true;
      if (right == 'w') self.otherGroupWriteInput.checked = true;
      if (right == 'x') self.otherGroupExecuteInput.checked = true;
    });
  }

  setNumericInput(permissions) {
    const self = this;

    self.numericInput.getModel().setText(permissions);
  }

  updateNumericInput() {
    const self = this;

    let permissionsuser = 0;
    let permissionsgroup = 0;
    let permissionsother = 0;

    if (self.ownerGroupReadInput.checked == true) permissionsuser += 4;
    if (self.ownerGroupWriteInput.checked == true) permissionsuser += 2;
    if (self.ownerGroupExecuteInput.checked == true) permissionsuser += 1;

    if (self.groupGroupReadInput.checked == true) permissionsgroup += 4;
    if (self.groupGroupWriteInput.checked == true) permissionsgroup += 2;
    if (self.groupGroupExecuteInput.checked == true) permissionsgroup += 1;

    if (self.otherGroupReadInput.checked == true) permissionsother += 4;
    if (self.otherGroupWriteInput.checked == true) permissionsother += 2;
    if (self.otherGroupExecuteInput.checked == true) permissionsother += 1;

    let permissions = permissionsuser.toString() + permissionsgroup.toString() + permissionsother.toString();

    self.disableEventhandler = true;
    self.enableFieldset('owner');
    self.enableFieldset('group');
    self.enableFieldset('other');
    self.setNumericInput(permissions);
    self.validate();
    self.disableEventhandler = false;
  }

  updateCheckboxInputs() {
    const self = this;

    let permissions = self.numericInput.getModel().getText();
    if (permissions.length != 0 && permissions.length != 3) return self.validate();
    let rights = permissionsToRights(permissions);

    self.disableEventhandler = true;
    self.setCheckboxInputs(rights);
    if (permissions[0] == 'x') { self.disableFieldset('owner'); } else { self.enableFieldset('owner'); };
    if (permissions[1] == 'x') { self.disableFieldset('group'); } else { self.enableFieldset('group'); };
    if (permissions[2] == 'x') { self.disableFieldset('other'); } else { self.enableFieldset('other'); };
    self.validate();
    self.disableEventhandler = false;
  }

  validate() {
    const self = this;

    let isvalid = true;
    let allowed = ['x', '0', '1', '2', '3', '4', '5', '6', '7'];
    let permissions = self.numericInput.getModel().getText();

    if (permissions.length != 3 || permissions == '000') isvalid = false;

    permissions.split('').forEach(function (value) {
      if (allowed.indexOf(value) == -1) {
        isvalid = false;
      }
    });

    if (isvalid) {
      self.saveButton.removeAttribute("disabled");
    } else {
      self.saveButton.setAttribute("disabled", true);
    }
  }

  attach() {
    const self = this;

    if (!self.item) return;

    self.setCheckboxInputs(self.rights);
    self.setNumericInput(rightsToPermissions(self.rights));
    self.validate();

    this.panel = atom.workspace.addModalPanel({
      item: this
    });

    self.numericInput.focus();
    self.numericInput.getModel().scrollToCursorPosition();
  };

  close() {
    const destroyPanel = this.panel;
    this.panel = null;

    if (destroyPanel) {
      destroyPanel.destroy();
    }

    atom.workspace.getActivePane().activate();
  }

  cancel() {
    this.close();
  }

  save() {
    const self = this;

    let permissions = rightsToPermissions(permissionsToRights(self.numericInput.getModel().getText()));

    this.trigger('change-permissions', {
      permissions: permissions,
      rights: permissionsToRights(permissions)
    });
    self.close();
  }
}
