'use babel';

import Dialog from './dialog';
import { normalize } from './../helper/format.js';

export default class AddDialog extends Dialog {

  constructor(initialPath, isFile) {
    super({
      prompt: isFile ? 'Enter the path for the new file.' : 'Enter the path for the new folder.',
      initialPath,
      select: false,
      iconClass: isFile ? 'icon-file-add' : 'icon-file-directory-create',
    });
    this.isCreatingFile = isFile;
  }

  onConfirm(relativePath) {
    // correct whitespaces and slashes
    relativePath = normalize(relativePath.split('/').map((item) => {
      return item.trim();
    }).join('/'));

    this.trigger('new-path', [relativePath]);
  }
}
