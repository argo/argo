var LinkedList = require('./linkedList');

function Builder() {
  this._middleware = [];
  this._targetApp = null;
  this._eventHandlerMap = new EventHandlerMap();
  this._ebh = this._buildHandler(this._eventHandlerMap);
}

Builder.prototype.use = function(middleware) {
  this._middleware.push(middleware);
};

Builder.prototype.run = function(app) {
  this._targetApp = app;
};

Builder.prototype._buildHandler = function(eventHandlerMap) {
  return function eventedBuildHandler(event, options, handler) {
    if (typeof options === 'function') {
      handler = options;
      options = null;
    }

    if (eventHandlerMap[event]) {
      options = options || {};
      options.hoist = options.hoist || false;
      options.sink = options.sink || false;

      var prefix = '';
      if (options.hoist) {
        prefix = 'pre';
      } else if (options.sink) {
        prefix = 'post';
      }

      var operation = options.hoist ? 'unshift' : 'push';
      var event = prefix + event;
      var m = eventHandlerMap[event];

      m[operation].call(m, handler);
    }
  };
};

Builder.prototype.build = function() {
  //var eventHandlerMap = new EventHandlerMap();

  var handle = this._ebh;
  this._middleware.forEach(function(middleware) {
    middleware(handle);
  });

  var pipeline = new LinkedList();
  this._targetApp = this._targetApp || function(env, next) { next(env); };
  var handlers = this._eventHandlerMap.prerequest.concat(
      this._eventHandlerMap.request,
      this._eventHandlerMap.postrequest,
      this._targetApp,
      this._eventHandlerMap.preresponse,
      this._eventHandlerMap.response.reverse(),
      this._eventHandlerMap.postresponse);

  /*console.log('request:', eventHandlerMap.request.length);
  console.log('preresponse:', eventHandlerMap.preresponse.length);
  console.log('response', eventHandlerMap.response.length);
  console.log('postresponse', eventHandlerMap.postresponse.length);*/

  handlers = handlers.slice(0).reverse();

  handlers.forEach(function(handler) {
    var obj = new LinkedList.Node(function(next) {
      var that = this;
      return function(env, callback) {
        /*console.log('-- start --');
        console.log('next: ', next);
        console.log('callback: ', callback);
        console.log('-- end --');
        if (callback) {
          next(env);
        }*/
        handler(env, next);
        if (callback) that.next = callback;
      };
    });

    pipeline.add(obj);
  });

  var node = pipeline.head();

  var _app = new LinkedList.Node();
  _app = node.value;
  while (node) {
    _app = node.value(_app);
    node = node.next;
  }
  
  return _app;
};

/*Builder.prototype.call = function(env) {
  var app = this.build();
  app(env);
};*/

function EventHandlerMap() {
  this.request = [];
  this.response = [];
  this.preresponse = [];
  this.postresponse = [];
  this.prerequest = [];
  this.postrequest = [];
}

module.exports = Builder;
