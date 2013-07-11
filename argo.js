var http = require('http');
var https = require('https');
var url = require('url');
var Stream = require('stream');
var environment = require('./environment');
var Frame = require('./frame');
var Builder = require('./builder');
var runner = require('./runner');

// Maximum number of sockets to keep alive per target host
// TODO make this configurable
var SocketPoolSize = 1024;
var _httpAgent, _httpsAgent;

var Argo = function(_http) {
  this._router = {};
  this._routerKeys = [];
  this.builder = new Builder();
  this._http = _http || http;

  _httpAgent = new this._http.Agent();
  _httpsAgent = new https.Agent();

  _httpAgent.maxSockets = _httpsAgent.maxSockets = SocketPoolSize;

  var that = this;
  var incoming = this._http.IncomingMessage.prototype;

  if (!incoming._argoModified) {
    var _addHeaderLine = incoming._addHeaderLine;

    incoming._addHeaderLine = function(field, value) {
      this._rawHeaderNames = this._rawHeaderNames || {};
      this._rawHeaderNames[field.toLowerCase()] = field;

      _addHeaderLine.call(this, field, value);
    };

    incoming.body = null;
    incoming.getBody = that._getBody();
    incoming._argoModified = true;
  }

  var serverResponse = this._http.ServerResponse.prototype;
  if (!serverResponse._argoModified) {
    serverResponse.body = null;
    serverResponse.getBody = that._getBody();

    serverResponse._argoModified = true;
  }
};

Argo.prototype._getBody = function() {
  var that = this;
  return function(callback) {
    if (this.body) {
      callback(null, this.body);
      return;
    }
    var buf = [];
    var len = 0;

    this.on('data', function(chunk) {
      buf.push(chunk);
      len += chunk.length;
    });

    this.on('error', function(err) {
      callback(err);
    });

    this.on('end', function() {
      var body;
      if (buf.length && Buffer.isBuffer(buf[0])) {
        body = new Buffer(len);
        var i = 0;
        buf.forEach(function(chunk) {
          chunk.copy(body, i, 0, chunk.length);
          i += chunk.length;
        });
      } else if (buf.length) {
        body = buf.join('');
      }

      this.body = body;

      callback(null, body);
    });
  };
};

Argo.prototype.include = function(mod) {
  var p = mod.package(this);
  p.install();
  return this;
};

Argo.prototype.listen = function(port) {
  runner.listen(this, port);
  return this;
};

Argo.prototype.use = function(middleware) {
  if (middleware.package) {
    return this.include(middleware);
  }
  this.builder.use(middleware);
  return this;
};

Argo.prototype.target = function(url) {
  return this.use(function(handler) {
    handler('request', function(env, next) {
      env.target.url = url + (env.request.url || '');
      next(env);
    });
  });
};

Argo.prototype.embed = function() {
  this.buildCore();

  this.builder.run(this._target);
  this.builder.use(function(handler) {
    handler('response', { affinity: 'sink' }, function(env, next) {
      if (env.argo.oncomplete) {
        env.argo.oncomplete(env);
      };
    });
  });

  return this.builder.build();
}

Argo.prototype.buildCore = function() {
  var that = this;

  that.builder.use(function(handler) {
    handler('request', function(env, next) {
      env.argo._http = that._http;
      next(env);
    });
  });

  /*var hasRoutes = false;
  for (var prop in that._router) {
    if (!hasRoutes && that._router.hasOwnProperty(prop)) {
      hasRoutes = true;
    }
  }

  if (hasRoutes) {
    that.builder.use(function addRouteHandlers(handlers) { 
     that._route(that._router, handlers);
    });
  }*/
};

Argo.prototype.build = function() {
  var that = this;

  that.buildCore();

  that.builder.run(that._target);

  // response ender
  that.builder.use(function(handle) {
    handle('response', { affinity: 'sink' }, function(env, next) {
      if (env.response.body) {
        var body = env.response.body;
        if (typeof body === 'string') {
          env.response.setHeader('Content-Length', body ? body.length : 0); 
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end(body);
        } else if (body instanceof Stream) {
          env.response.writeHead(env.response.statusCode, env.response.headers);
          body.pipe(env.response);
        } else if (typeof body === 'object') {
          body = new Buffer(JSON.stringify(body), 'utf-8');
          if (!env.response.getHeader('Content-Type')) {
            env.response.setHeader('Content-Type', 'application/json; charset=UTF-8');
          }
          env.response.setHeader('Content-Length', body ? body.length : 0); 
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end(body.toString('utf-8'));
        }
      } else {
        var contentLength = env.response.getHeader('Content-Length');
        if (contentLength == '0') {
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end();
        } else if (env.target.response) {
          env.target.response.getBody(function(err, body) {
            env.response.setHeader('Content-Length', body ? body.length : 0); 
            env.response.writeHead(env.response.statusCode, env.response.headers);
            env.response.end(body);
          });
        } else {
          env.response.setHeader('Content-Length', '0'); 
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end();
        }
      }
    });
  });

  var built = that.builder.build();
  built._pipeline = this._pipeline;

  var self = this;
  built.run = function(req, res) {
    var env = environment(self, req, res);
    built.flow(env);
  }

  return built;
};

Argo.prototype.call = function(env) {
  var app = this.build();
  return app.flow(env);
}

Argo.prototype.route = function(path, options, handlers) {
  if (typeof(options) === 'function') {
    handlers = options;
    options = {};
  }

  options.methods = options.methods || ['*'];
  if (!this._router[path]) {
    this._router[path] = {};
  }

  var that = this;
  options.methods.forEach(function(method) {
    that._router[path][method.toLowerCase()] = handlers;
  });

  that._routerKeys.push(path);
  that._routerKeys.sort(function(a, b) {
    if (a.length > b.length) {
      return -1;
    } else if (a.length < b.length) {
      return 1;
    }

    return 0;
  });

  that.builder.use(function addRouteHandlers(handlers) { 
   that._route(that._router, handlers);
  });

  return this;
};

var methods = {
  'get': 'GET',
  'post': 'POST',
  'put': 'PUT',
  'del': 'DELETE',
  'head': 'HEAD',
  'options': 'OPTIONS',
  'trace': 'TRACE'
};

Object.keys(methods).forEach(function(method) {
  Argo.prototype[method] = function(path, options, handlers) {
    if (typeof(options) === 'function') {
      handlers = options;
      options = {};
    }
    options.methods = [methods[method]];
    return this.route(path, options, handlers);
  };
});

Argo.prototype.map = function(path, options, handler) {
  if (typeof(options) === 'function') {
    handler = options;
    options = {};
  }

  options.methods = options.methods || ['*'];
  if (!this._router[path]) {
    this._router[path] = {};
  }

  var that = this;
  function generateHandler(path, handler) {
    var argo = new Argo(that._http);
    handler(argo);

    var app = argo.embed();

    return function(handler) {
      handler('request', function mapHandler(env, next) {
        env.argo.frames = env.argo.frames || [];
        
        var frame = new Frame();
        frame.routed = env.argo._routed;
        frame.mapped = env.argo.mapped;
        frame.routedResponseHandler = env.argo._routedResponseHandler;
        frame.targetUrl = env.target.url;

        env.argo._routed = false;
        env.argo._mapped = true;
        env.argo._routedResponseHandler = null;
        env.target.url = null;

        if (env.request.url[env.request.url.length - 1] === '/') {
          env.request.url = env.request.url.substr(0, env.request.url.length - 1);
        }

        if (env.argo.frames.length) {
          pathLength = 0;
          env.argo.frames.forEach(function(frame) {
            pathLength += frame.routeUri.length;
          });
        }

        frame.routeUri = path || '/';

        env.request.url = env.request.url.substr(frame.routeUri.length);
        env.request.url = env.request.url || '/';

        // TODO: See if this can work in a response handler here.
        
        if (env.argo.oncomplete) {
          frame.oncomplete = env.argo.oncomplete;
        }

        env.argo.currentFrame = frame;
        env.argo.frames.push(frame);

        env.argo.oncomplete = function(env) {
          var frame = env.argo.frames.pop();

          env.argo._routed = frame.routed;
          env.argo._routedResponseHandler = frame.routedResponseHandler;
          env.request.url = frame.routeUri + env.request.url;
          env.argo.oncomplete = frame.oncomplete;
          env.target.url = frame.targetUrl;
          env.argo._mapped = frame.mapped;

          next(env);
        };

        app.flow(env);
      });
    };
  };

  return this.route(path, options, generateHandler(path, handler));
};

Argo.prototype._pipeline = function(name) {
  return this.builder.pipelineMap[name];
};

Argo.prototype._addRouteHandlers = function(handlers) {
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

Argo.prototype._routeRequestHandler = function(router) {
  var that = this;
  return function routeRequestHandler(env, next) {
    if (env.argo.bypassRoute || env.argo._routed) {
      return next(env);
    }

    env.argo._routed = false;

    var search = env.request.url;
      
    var routerKey;
    if (search === '/' && that._router['/']) {
      routerKey = '/';
    } else {
      that._routerKeys.forEach(function(key) {
        if (!routerKey && key !== '*' && search.search(key) !== -1 && key !== '/') {
          routerKey = key;
        }
      });
    }

    if (!routerKey && that._router['*']) {
      routerKey = '*';
    }

    if (routerKey &&
        (!router[routerKey][env.request.method.toLowerCase()] &&
         !router[routerKey]['*'])) {
      env.response.statusCode = 405;
      next(env);
      return;
    }

    if (routerKey &&
        (router[routerKey][env.request.method.toLowerCase()] ||
         router[routerKey]['*'])) {
      env.argo._routed = true;

      var method = env.request.method.toLowerCase();
      var fn = router[routerKey][method] ? router[routerKey][method] 
        : router[routerKey]['*'];

      var handlers = new RouteHandlers();
      fn(that._addRouteHandlers(handlers));

      env.argo._routedResponseHandler = handlers.response || null;

      if (handlers.request) {
        handlers.request(env, next);
      } else {
        next(env);
        return;
      }
    }
    
    if (!env.argo._routed) {
      next(env);
    }
  };
};

Argo.prototype._routeResponseHandler = function(router) {
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

Argo.prototype._route = function(router, handle) {
  handle('request', this._routeRequestHandler(router));
  handle('response', { affinity: 'hoist' }, this._routeResponseHandler(router));
};

Argo.prototype._target = function(env, next) {
  if (env.response._headerSent || env.target.skip) {
    next(env);
    return;
  }

  env.target.skip = true;

  if (env.target && env.target.url) {
    var options = {};
    options.method = env.request.method || 'GET';

    options.agent = env.argo._agent;

    var parsed = url.parse(env.target.url);
    var isSecure = parsed.protocol === 'https:';
    options.hostname = parsed.hostname;
    options.port = parsed.port || (isSecure ? 443 : 80);
    options.path = parsed.path;
    options.agent = (isSecure ? _httpsAgent : _httpAgent);

    options.headers = env.request.headers;
    //options.headers['Connection'] = 'keep-alive';
    options.headers['Host'] = options.hostname;

    if (parsed.auth) {
      options.auth = parsed.auth;
    }

    var client = (isSecure ? https : env.argo._http);

    env.argo._routed = true;
    var req = client.request(options, function(res) {
      for (var key in res.headers) {
        var headerName = res._rawHeaderNames[key] || key;
        env.response.setHeader(headerName, res.headers[key]);
      }

      env.response.statusCode = res.statusCode;

      env.target.response = res;


      if (next) {
        next(env);
      }
    });

    req.on('error', function(err) {
      // Error connecting to the target or target not available -- respond with an error
      env.response.statusCode = 503;
      req.socket.destroy();
      next(env);
    });

    env.request.getBody(function(err, body) {
      if (body) {
        req.write(body);
      }

      req.end();
    });
  } else {
    next(env);
  }
};

var argo = function(_http) { return new Argo(_http); }
argo.environment = environment;

module.exports = argo;
//module.exports = function(_http) { return new Argo(_http) };
