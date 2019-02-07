'use babel';

import Dialog from './dialog';
import { normalize } from '../helper/format.js';

export default class DuplicateDialog extends Dialog {

  constructor(initialPath) {
    super({
      prompt: 'Enter the new path for the duplicate.',
      initialPath,
      select: true,
      iconClass: 'icon-arrow-right',
    });
  }

  onConfirm(relativePath) {
    // correct whitespaces and slashes
    relativePath = normalize(relativePath);

    this.trigger('new-path', [relativePath]);
  }
}
