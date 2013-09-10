var Proxy = module.exports = function(http, https) {
  this.http = http;
  this.https = https;
  this.argo = null;
};

Proxy.install = function(container) {
  var component = container.component;

  container.register({
    name: 'argo.proxy',
    id: 'argo.proxy.default',
    value: Proxy,
    params: [component('argo.http'), component('argo.https')]
  });
};

Proxy.prototype.init = function(argo) {
  this.argo = argo;
  this.argo._target = this._target.bind(this);
};

Proxy.prototype._target = function(env, next) {
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
