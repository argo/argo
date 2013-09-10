var iv = require('iv');
var Argo = require('./argo');
var BodyHelper = require('./extensions/body_helper');
var Builder = require('./extensions/builder');
var Http = require('./extensions/http');
var HttpPatcher = require('./extensions/http_patcher');
var Https = require('./extensions/https');
var Proxy = require('./extensions/proxy');
var RouteHandler = require('./extensions/route_handler');
var Router = require('./extensions/router');
var Server = require('./extensions/server');

exports.assemble = function() {
  var extensions = [BodyHelper, Builder, Http, HttpPatcher,
      Https, Proxy, RouteHandler, Router, Server];

  var container = iv.create();

  extensions.forEach(function(extension) {
    extension.install(container);
  });

  var c = container.component;
  var a = container.array;
  var ext = a(
      c('argo.body_helper'),
      c('argo.http'),
      c('argo.https'),
      c('argo.http_patcher'),
      c('argo.router'),
      c('argo.route_handler'),
      c('argo.server'),
      c('argo.proxy'),
      c('argo.builder')
  );

  container.register({
    name: 'argo.core',
    id: 'argo.core.default',
    value: Argo,
    params: [ext]
  });

  return container;
};
