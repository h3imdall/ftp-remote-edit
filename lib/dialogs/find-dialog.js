'use babel';

import Dialog from './dialog';
import { normalize } from '../helper/format.js';

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
    relativePath = normalize(relativePath);

    this.trigger('find-path', [relativePath]);
  }
}
