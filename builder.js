function EventHandler(eventHandlerMap) {
  this.eventHandlerMap = eventHandlerMap;
};

EventHandler.prototype.add = function(event, options, handler) {
  if (typeof options === 'function') {
    handler = options;
    options = null;
  }

  if (this.eventHandlerMap[event]) {
    options = options || { hoist: false };

    var operation = options.hoist ? 'unshift' : 'push';
    var m = this.eventHandlerMap[event];
    m[operation].call(m, handler);
  }
};

function LinkedList() {
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

function Builder() {
  this._middleware = [];
  this._targetApp = null;
}

Builder.prototype.use = function(middleware) {
  this._middleware.push(middleware);
};

Builder.prototype.run = function(app) {
  this._targetApp = app;
};

Builder.prototype.build = function() {
  var eventHandlerMap = { 
    request: [],
    response: []
  };

  var handler = new EventHandler(eventHandlerMap);

  this._middleware.forEach(function(middleware) {
    middleware(handler);
  });

  var pipeline = new LinkedList();
  var handlers = eventHandlerMap.request.concat(this._targetApp, eventHandlerMap.response);

  handlers = handlers.slice(0).reverse();

  handlers.forEach(function(handler) {
    var middlewareFunc = function(next) {
      return function(env) {
        handler(env, next);
      };
    };

    pipeline.add(middlewareFunc);
  });

  /* For Array Pipeline */
  /*var app = pipeline.shift();
  pipeline.forEach(function(middleware) {
    app = middleware.call(this, app);
  });*/

  /*
  var app = this._run;
  var reversed = this._use.slice(0).reverse();
  
  for (var i = 0, len = reversed.length; i < len; i++) {
    app = reversed[i].call(this, app);
  }

  return app;
   */

  
  var node = pipeline.head();

  var app = node.value;
  while (node) {
    app = node.value(app);
    node = node.next;
  }
  
  return app;
};

Builder.prototype.call = function(env) {
  var app = this.build();
  app(env);
};

module.exports = Builder;
