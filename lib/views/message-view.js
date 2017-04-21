'use babel';

export default class MessageView {

  constructor(message) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('ftp-remote-edit');

    let closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.classList.add('btn');
    closeButton.addEventListener('click', (event) => {
      this.modal.destroy();
    });

    let configButton = document.createElement('button');
    configButton.textContent = 'Open config';
    configButton.classList.add('btn');
    configButton.addEventListener('click', (event) => {
      this.modal.destroy();
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'ftp-remote-edit:editconfiguration');
    });

    let labelDiv = document.createElement('div');
    let label = document.createElement('label');
    label.textContent = message;
    labelDiv.appendChild(label);

    this.element.appendChild(labelDiv);
    this.element.appendChild(configButton);
    this.element.appendChild(closeButton);

    this.addToModal();
  }

  addToModal () {
    this.modal = atom.workspace.addModalPanel({
      item: this
    });
  }


  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

  setModal (modal) {
    this.modal = modal;
  }

}
