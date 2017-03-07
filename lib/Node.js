'use babel';

// import { View } from 'atom';
// import { CompositeDisposable } from 'atom';

export default class Node {

  constructor() {
    // Create root element
    this.childNodes = [];
    this.element = document.createElement('div');
  }

  setConnection (connection) {
    this.connection = connection;
  }

  getConnection () {
    return this.connection;
  }

  append(element) {
    element.setConnection(this.connection);
    this.childNodes.push(element);
    this.element.appendChild(element.getElement());
  }

  getPathOnServer() {
    return this.element.getAttribute('pathOnServer');
  }

  getChildNodes() {
    return this.childNodes;
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  removeChildren() {
    this.childNodes = [];
  }

  getElement() {
    return this.element;
  }

  createLoader() {
    let loader = document.createElement('i');
    loader.classList.add('spin');
    loader.classList.add('loader');
    return loader;
  }

}
