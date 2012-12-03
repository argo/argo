var LinkedList = module.exports = function() {
  this._items = [];
  this._head = null;
};

LinkedList.prototype.add = function(item) {
  var lastItem = this._items[this._items.length - 1];

  var obj = { value: item, next: null };

  if (lastItem) {
    lastItem.next = obj;
  }

  this._items.push(obj);
};

LinkedList.prototype.head = function() {
  return this._items[0];
}

LinkedList.prototype.length = function() {
  return this._items.length;
};
