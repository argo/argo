var Argo = module.exports = function(server, proxy, builder, bodyHelper, routeHandler) {
  this.server = server;
  this.proxy = proxy;
  this.builder = builder;
  this.bodyHelper = bodyHelper;
  this.routeHandler = routeHandler;
};

Argo.prototype.init = function() {
  this.server.init(this);
  this.proxy.init(this);
};

Argo.prototype.include = function(mod) {
  var ext = mod.extension;
  extension.install();
  return this;
};

Argo.prototype.listen = function(port) {
  var app = this.build();

  this.server.createServer(app.run).listen(port);
};

Argo.prototype.use = function(middleware) {
  if (middleware.extension) {
    return this.include(middleware);
  }

  this.builder.use(middleware);
  return this;
};

var Assembler = function(container) {
  this.container = container;
};

Assembler.prototype.assemble = function(options) {
  return this.container.resolve('argo.core', [options]);
};
