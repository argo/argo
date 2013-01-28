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
      options.sink = options.sink || false;

      //var operation = options.hoist ? 'unshift' : 'push';

      var operation = 'push';
      if (options.hoist && event === 'response') {
        event = 'preResponse';
        operation = 'unshift';
      } else if (options.sink && event === 'response') {
        event = 'postResponse';
        operation = 'push';
      } else if (options.hoist && event === 'request') {
        event = 'preRequest';
        operation = 'unshift';
      } else if (options.sink && event === 'request') {
        event = 'postRequest';
        operation = 'push';
      }

      var m = eventHandlerMap[event];

      m[operation].call(m, handler);
    }
  };
};

Builder.prototype.build = function() {
  var eventHandlerMap = { 
    request: [],
    response: [],
    preResponse: [],
    postResponse: [],
    preRequest: [],
    postRequest: []
  };

  var handle = this._buildHandler(eventHandlerMap);
  this._middleware.forEach(function(middleware) {
    middleware(handle);
  });

  var pipeline = new LinkedList();
  this._targetApp = this._targetApp || function(env, next) { next(env); };
  var handlers = eventHandlerMap.preRequest.concat(
      eventHandlerMap.request,
      eventHandlerMap.postRequest,
      this._targetApp,
      eventHandlerMap.preResponse,
      eventHandlerMap.response.reverse(),
      eventHandlerMap.postResponse);

  /*console.log('request:', eventHandlerMap.request.length);
  console.log('preResponse:', eventHandlerMap.preResponse.length);
  console.log('response', eventHandlerMap.response.length);
  console.log('postResponse', eventHandlerMap.postResponse.length);*/

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
