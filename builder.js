var LinkedList = require('./linkedList');

function Builder() {
  this._middleware = [];
  this._targetApp = null;
}

Builder.prototype.use = function(middleware) {
  this._middleware.push(middleware);
};

Builder.prototype.run = function(app) {
  this._targetApp = app;
  /*this._targetApp = function() {
    var start = +Date.now();
    app.apply(app, arguments);
    var duration = +Date.now() - start;

    console.log('Duration (target): ' + duration);
  };*/
};

Builder.prototype._buildHandler = function(eventHandlerMap) {
  return function(event, options, handler) {
    if (typeof options === 'function') {
      handler = options;
      options = null;
    }

    if (eventHandlerMap[event]) {
      options = options || {};
      options.hoist = options.hoist || false;
      options.name = options.name || 'Middleware';

      var operation = options.hoist ? 'unshift' : 'push';
      var m = eventHandlerMap[event];

      var timedHandler = function() {
        var start = +Date.now();
        handler.apply(handler, arguments);
        var duration = +Date.now() - start;

        console.log('Duration (' + options.name + '): ' + duration);
      };

      //m[operation].call(m, timedHandler);
      m[operation].call(m, handler);
    }
  };
};

Builder.prototype.build = function() {
  var eventHandlerMap = { 
    request: [],
    response: []
  };

  var handle = this._buildHandler(eventHandlerMap);
  this._middleware.forEach(function(middleware) {
    middleware(handle);
  });

  var pipeline = new LinkedList();
  var handlers = eventHandlerMap.request.concat(this._targetApp, eventHandlerMap.response);

  handlers = handlers.slice(0).reverse();

  handlers.forEach(function(handler) {
    pipeline.add(function(next) {
      return function(env) {
        handler(env, next);
      };
    });
  });

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
