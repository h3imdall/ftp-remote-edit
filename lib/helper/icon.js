const { Emitter, CompositeDisposable } = require('atom')

let iconServices
module.exports = function getIconServices() {
  if (!iconServices) iconServices = new IconServices()
  return iconServices
}

class IconServices {
  constructor() {
    this.emitter = new Emitter()
    this.elementIcons = null
    this.elementIconDisposables = new CompositeDisposable()
  }

  onDidChange(callback) {
    return this.emitter.on('did-change', callback)
  }

  resetElementIcons() {
    this.setElementIcons(null)
  }

  setElementIcons(service) {
    if (service !== this.elementIcons) {
      if (this.elementIconDisposables != null) {
        this.elementIconDisposables.dispose()
      }
      if (service) {
        this.elementIconDisposables = new CompositeDisposable()
      }
      this.elementIcons = service
      this.emitter.emit('did-change')
    }
  }

  updateFileIcon(view) {
    if (this.elementIcons) {
      const disposable = this.elementIcons(view.label[0], view.getLocalPath() + view.name)
      this.elementIconDisposables.add(disposable)
    } else {
      let iconClass
      iconClass = 'icon-file-text'
      view.label[0].classList.add(iconClass)
    }
  }
}
