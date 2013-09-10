var RouteHandler = module.exports = function() {
  this.argo = null;
};

RouteHandler.install = function(container) {
  container.register({
    name: 'argo.route_handler',
    id: 'argo.route_handler.default',
    value: RouteHandler,
    params: [container.component('argo.router')]
  });
};

RouteHandler.prototype.init = function(argo) {
  this.argo = argo;
  var proto = this.argo.__proto__;

  proto._route = this._route.bind(this.argo);
  proto.route = this.route.bind(this.argo);
  proto._routeRequestHandler = this._routeRequestHandler.bind(this.argo);
  proto._routeResponseHandler = this._routeResponseHandler.bind(this.argo);
  proto._addRouteHandlers = this._addRouteHandlers.bind(this.argo);

  var methods = {
    'get': 'GET',
    'post': 'POST',
    'put': 'PUT',
    'del': 'DELETE',
    'head': 'HEAD',
    'options': 'OPTIONS',
    'trace': 'TRACE'
  };

  var self = this.argo;
  Object.keys(methods).forEach(function(method) {
    proto[method] = function(path, options, handlers) {
      if (typeof(options) === 'function') {
        handlers = options;
        options = {};
      }
      options.methods = [methods[method]];
      return this.route(path, options, handlers);
    }.bind(self);
  });
};

RouteHandler.prototype.route = function(path, options, handleFn) {
  if (typeof(options) === 'function') {
    handleFn = options;
    options = {};
  }

  this.router.add(path, options.methods, handleFn);
  console.log('adding:', path);
  console.log(path, this.router._router);

  var self = this;
  this.builder.use(function addRouteHandleFn(handleFn) { 
   self._route(self.router, handleFn);
  });

  console.log(this);
  return this;
};

RouteHandler.prototype._route = function(router, handle) {
  handle('request', this._routeRequestHandler(router));
  handle('response', { affinity: 'hoist' }, this._routeResponseHandler(router));
};

RouteHandler.prototype._addRouteHandlers = function(handlers) {
  return function add(name, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = null;
    }

    if (name === 'request') {
      handlers.request = cb;
    } else if (name === 'response') {
      handlers.response = cb;
    }
  };
};

function RouteHandlers() {
  this.request = null;
  this.response = null;
}

RouteHandler.prototype._routeRequestHandler = function(router) {
  var that = this;
  return function routeRequestHandler(env, next) {
    console.log('in handler', env.request.url);
    if (env.argo.bypassRoute || env.argo._routed) {
      return next(env);
    }

    var routeResult = router.find(env.argo.currentUrl, env.request.method);
    console.log('routeResult:', routeResult);

    if (!routeResult.warning) {
      env.argo._routed = true;

      if (routeResult.params) {
        env.request.params = routeResult.params;
      }

      var fn = routeResult.handlerFn;

      var handlers = new RouteHandlers();
      fn(that._addRouteHandlers(handlers));

      env.argo._routedResponseHandler = handlers.response || null;

      if (handlers.request) {
        handlers.request(env, next);
      } else {
        next(env);
        return;
      }
    } else if (routeResult.warning === 'MethodNotSupported') {
      env.response.statusCode = 405;
      return next(env);
    } else {
      env.argo._routed = false;
      return next(env);
    }
  };
};

RouteHandler.prototype._routeResponseHandler = function(router) {
  var that = this;
  return function routeResponseHandler(env, next) {
    if (!env.argo._routed) {
      if (env.response.statusCode !== 405
          && !(env.target && env.target.url)) {
        env.response.statusCode = 404;
      }

      next(env);
      return;
    }

    if (env.argo._routedResponseHandler) {
      env.argo._routedResponseHandler(env, next);
      return;
    } else {
      next(env);
      return;
    }
  };
};
