var EventEmitter = require('events').EventEmitter;

var Pipeline = module.exports = function() {
  this._use = [];
  this._run = null;
  this._handler = new EventEmitter();
}

Pipeline.init = function(app) {
  var pipeline = new Pipeline();

  if (typeof app === 'object') {
    pipeline.run(app);
    return pipeline;
  } else if (typeof app === 'function') {
    app(pipeline);

    return pipeline;
  }

  return pipeline;
};

Pipeline.app = function(app) {
  var pipeline = Pipeline.create(app);
  return pipeline.toApp();
};

Pipeline.prototype.use = function(middleware) {
  /*var middlewareFunc = function(app) {
    var call = function(env, callback) {
      try {
        middleware(env, app); 

        if (callback) {
          callback(null, env);
        }
      } catch (err) {
        if (callback) {
          callback(err);
        }
      }
    };
    return { call: call };
  };

  this._use.push(middlewareFunc);*/

  //var handler = new EventEmitter();
  //middleware(handler);
  
  var call = function(handler) {
    return middleware(handler);
  };

  return this;
};

Pipeline.prototype.run = function(app) {
  this._run = { call: app };
  return this;
};

Pipeline.prototype.toApp = function() {
  var app = this._run;
  var reversed = this._use.slice(0).reverse();
  
  for (var i = 0, len = reversed.length; i < len; i++) {
    app = reversed[i].call(this, app);
  }

  return app;
};

Pipeline.prototype.call = function(env, callback) {
  var app = this.toApp();

  try {
    //console.log('env before app call:', !!env);
    app.call(env); 
    console.log('app callback exists?', callback);
    if (callback) {
      callback(null, env);
    }
  } catch (err) {
    if (callback) {
      callback(err);
    }
  }
};
