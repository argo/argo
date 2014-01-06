var http = require('http');
var https = require('https');
var url = require('url');
var Stream = require('stream');
var path = require('path');
var pipeworks = require('pipeworks');
var environment = require('./environment');
var Frame = require('./frame');
var Builder = require('./builder');
var RegExpRouter = require('./regexp_router');

// Maximum number of sockets to keep alive per target host
// TODO make this configurable
var SocketPoolSize = 1024;
var _httpAgent, _httpsAgent;

var Argo = function(_http) {
  this.router = RegExpRouter.create();
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

      _addHeaderLine.call(this, field, value, incoming);
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
  return function(callback) {
    if (this.body !== null && this.body !== undefined) {
      return callback(null, this.body);
    }

    if (!this.readable) {
      return callback();
    }

    var self = this;
    var buf = [];
    var len = 0;
    var body;

    this.on('readable', function() {
      var chunk;

      while ((chunk = self.read()) != null) {
        buf.push(chunk);
        len += chunk.length;
      }

      if (!buf.length) {
        return;
      }

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
    });

    var error = null;
    this.on('error', function(err) {
      error = err;
    });

    this.on('end', function() {
      self.body = body;
      callback(error, body);
    });

    if (typeof this.read === 'function') {
      this.read(0);
    }
  };
};

Argo.prototype.include = function(mod) {
  var p = mod.package(this);
  p.install();
  return this;
};

Argo.prototype.listen = function() {
	var server = this._http.createServer(this.build().run);
	server.listen.apply(server, arguments);
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
    handler('request', { affinity: 'hoist' }, function(env, next) {
      env.argo._http = that._http;
      if (!env.argo.currentUrl) {
        env.argo.currentUrl = env.request.url;
      }

      if (!env.argo.uri) {
        env.argo.uri = function() {
          var xfp = env.request.headers['x-forwarded-proto'];
          var protocol;

          if (xfp && xfp.length) {
            protocol = xfp.replace(/\s*/, '').split(',')[0];
          } else {
            protocol = env.request.connection.encrypted ? 'https' : 'http';
          }

          var host = env.request.headers['host'];

          if (!host) {
            var address = env.request.connection.address();
            host = address.address;
            if (address.port) {
              if (!(protocol === 'https' && address.port === 443) && 
                  !(protocol === 'http' && address.port === 80)) {
                host += ':' + address.port
              }
            }
          }

          return protocol + '://' + path.join(host, env.request.url);
        }
      }
      next(env);
    });
  });
};

Argo.prototype.build = function() {
  var that = this;

  that.buildCore();

  that.builder.run(that._target);

  // response ender
  that.builder.use(function(handle) {
    handle('response', { affinity: 'sink' }, function(env, next) {
      if (env.response.body !== null && env.response.body !== undefined) {
        var body = env.response.body;
        if (typeof body === 'string') {
          env.response.setHeader('Content-Length', body ? body.length : 0); 
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end(body);
        } else if (body instanceof Stream) {
          env.response.writeHead(env.response.statusCode, env.response.headers);
          body.pipe(env.response);
        } else if (body instanceof Buffer) {
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end(body);
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
        } else if (env.target.response !== null && env.target.response !== undefined) {
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

Argo.prototype.route = function(path, options, handleFn) {
  if (typeof(options) === 'function') {
    handleFn = options;
    options = {};
  }

  var opts = {
    methods: options.methods,
    actsAsPrefix: false
  };

  this.router.add(path, options, handleFn);

  var self = this;
  this.builder.use(function addRouteHandleFn(handleFn) { 
   self._route(self.router, handleFn);
  });

  return this;
};

Argo.prototype._routeMap = function(path, options, handleFn) {
  if (typeof(options) === 'function') {
    handleFn = options;
    options = {};
  }

  var opts = {
    methods: options.methods,
    actsAsPrefix: true
  };

  this.router.add(path, opts, handleFn);

  var self = this;
  this.builder.use(function addRouteHandleFn(handleFn) { 
   self._route(self.router, handleFn);
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

  var that = this;
  function generateHandler(path, handler) {
    var argo = new Argo(that._http);
    argo.router = that.router.create();

    handler(argo);

    var app = argo.embed();

    return function(handler) {
      handler('request', function mapHandler(env, next) {
        env.argo.frames = env.argo.frames || [];
        
        var frame = new Frame();
        frame.routed = env.argo._routed;
        frame.routedResponseHandler = env.argo._routedResponseHandler;
        frame.targetUrl = env.target.url;

        env.argo._routed = false;
        env.argo._routedResponseHandler = null;
        env.target.url = null;

        if (env.argo.currentUrl[env.argo.currentUrl.length - 1] === '/') {
          env.argo.currentUrl = env.argo.currentUrl.substr(0, env.argo.currentUrl.length - 1);
        }

        frame.routeUri = path;

        var previousUrl = env.argo.currentUrl;
        env.argo.currentUrl = that.router.truncate(env.argo.currentUrl, frame.routeUri) || '/';

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
          env.argo.currentUrl = previousUrl;
          env.argo.oncomplete = frame.oncomplete;
          env.target.url = frame.targetUrl;

          next(env);
        };

        app.flow(env);
      });
    };
  };

  return this._routeMap(path, options, generateHandler(path, handler));
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
      handlers.request.push(cb);
    } else if (name === 'response') {
      handlers.response.push(cb);
    }
  };
};

function RouteHandlers() {
  this.request = [];
  this.response = [];
}

Argo.prototype._routeRequestHandler = function(router) {
  var that = this;
  return function routeRequestHandler(env, next) {
    if (env.argo.bypassRoute || env.argo._routed) {
      return next(env);
    }

    var routeResult = router.find(env.argo.currentUrl, env.request.method);

    if (!routeResult.warning) {
      env.argo._routed = true;

      env.route = env.route || {};

      if (routeResult.params) {
        env.route.params = routeResult.params;
      }

      var fn = routeResult.handlerFn;

      var handlers = new RouteHandlers();
      fn(that._addRouteHandlers(handlers));

      env.argo._routedResponseHandler = handlers.response || null;

      if (handlers.request.length) {
        var pipeline = pipeworks();

        handlers.request.forEach(function(handler) {
          pipeline.fit(handler);
        });

        pipeline.fit(function(env, n) {
          next(env);
        });

        pipeline.flow(env);
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

Argo.prototype._routeResponseHandler = function(router) {
  var that = this;
  return function routeResponseHandler(env, next) {
    if (!env.argo._routed) {
      if (env.response.statusCode !== 405
          && !(env.target && env.target.url)
          && !env.response.body) {
        env.response.statusCode = 404;
      }

      next(env);
      return;
    }

    if (env.argo._routedResponseHandler && env.argo._routedResponseHandler.length) {
      var pipeline = pipeworks();

      env.argo._routedResponseHandler.forEach(function(handler) {
        pipeline.fit(handler);
      });

      pipeline.fit(function(env, n) {
        env.argo._routedResponseHandler = null;
        next(env);
      });

      pipeline.flow(env);

      return;
    } else {
      next(env);
      return;
    }
  };
};

Argo.prototype._route = function(router, handle) {
  handle('route:request', this._routeRequestHandler(router));
  handle('route:response', { affinity: 'hoist' }, this._routeResponseHandler(router));
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
