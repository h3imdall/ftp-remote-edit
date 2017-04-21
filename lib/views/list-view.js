'use babel';

// import { View } from 'atom';
// import { CompositeDisposable } from 'atom';

import Node from './Node.js';

export default class ListView extends Node {

  constructor() {
    // Create root element

    super();

    this.element = document.createElement('ul');
    this.element.classList.add('list');

  }


  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

}
