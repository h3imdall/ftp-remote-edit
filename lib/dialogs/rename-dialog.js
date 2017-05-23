'use babel';

import Dialog from './dialog';

export default class RenameDialog extends Dialog {

  constructor(initialPath, isFile) {
    super({
      prompt: isFile ? 'Enter the new path for the file.' : 'Enter the new path for the folder.',
      initialPath,
      select: false,
      iconClass: 'icon-arrow-right',
    });
    this.isCreatingFile = isFile;
  }

  onConfirm(relativePath) {
    // correct whitespaces and slashes
    relativePath = relativePath.split('/')
    .map(function (item) { return item.trim(); }).join('/')
    .replace(/\/+/g, "/")
    .replace(/\\+/g, "/");
    
    this.trigger('new-path', [relativePath]);
  }
}
