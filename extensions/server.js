var Server = module.exports = function(http) {
  this.http = http;
  this.argo = null;
  this.server = null;
};

Server.install = function(container) {
  container.register({
    name: 'argo.server',
    id: 'argo.server.http',
    value: Server,
    params: [container.component('argo.http')]
  });
};

Server.prototype.init = function(argo) {
  this.argo = argo;
  argo.server = this;
};

Server.prototype.createServer = function(listener) {
  this.server = this.http.createServer(listener);
  return this;
};

Server.prototype.listen = function(port, hostname, backlog, callback) {
  this.server.listen(port, hostname, backlog, callback);
};
