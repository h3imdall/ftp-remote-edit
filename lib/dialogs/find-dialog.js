'use babel';

import Dialog from './dialog';

export default class FindDialog extends Dialog {

  constructor(initialPath, isFile) {
    super({
      prompt: 'Enter the path for the folder.',
      initialPath,
      select: false,
      iconClass: 'icon-search',
    });
    this.isCreatingFile = isFile;
  }

  onConfirm(relativePath) {
    // correct whitespaces and slashes
    relativePath = relativePath.split('/')
    .map(function (item) { return item.trim(); }).join('/')
    .replace(/\/+/g, "/")
    .replace(/\\+/g, "/");
    
    this.trigger('find-path', [relativePath]);
  }
}
