'use babel';

import Dialog from './dialog';
import { normalize } from '../helper/format.js';

export default class RenameDialog extends Dialog {

  constructor(initialPath, isFile) {
    super({
      prompt: isFile ? 'Enter the new path for the file.' : 'Enter the new path for the directory.',
      initialPath,
      select: true,
      iconClass: 'icon-arrow-right',
    });
    this.isCreatingFile = isFile;
  }

  onConfirm(relativePath) {
    // correct whitespaces and slashes
    relativePath = normalize(relativePath);

    this.trigger('new-path', [relativePath]);
  }
}
