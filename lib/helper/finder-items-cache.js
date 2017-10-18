'use babel';

class FinderItemsCache {

    setItems(items) {
        const self = this;
        self.items = items;
    }

    getItems() {
        const self = this;
        return self.items;
    }

    addItem(relativePath, size = 0) {
        const self = this;
        if(!self.items) {
            return;
        }
        relativePath = relativePath.replace(/^\//, '');
        self.items.push({relativePath, size});
    }

    deleteItem(relativePath) {
        const self = this;
        if(!self.items) {
            return;
        }
        self.items = self.items.filter((item) => {
            return item.relativePath != relativePath; 
        })
    }

}

module.exports = FinderItemsCache;