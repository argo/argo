var http = require('http');
var https = require('https');

// Maximum number of sockets to keep alive per target host
// TODO make this configurable
var SocketPoolSize = 1024;
var httpAgent, httpsAgent;

var HttpPatcher = module.exports = function() {
  this.argo = null;
};

HttpPatcher.install = function(container) {
  var component = container.component;

  container.register({
    name: 'argo.http_patcher',
    id: 'argo.http_patcher.default',
    value: HttpPatcher,
    params: []
  });
};

HttpPatcher.prototype.init = function(argo) {
  this.argo = argo;

  httpAgent = new http.Agent();
  httpsAgent = new https.Agent();

  httpAgent.maxSockets = httpsAgent.maxSockets = SocketPoolSize;

  var that = this;
  var incoming = http.IncomingMessage.prototype;

  if (!incoming._argoModified) {
    var _addHeaderLine = incoming._addHeaderLine;

    incoming._addHeaderLine = function(field, value) {
      this._rawHeaderNames = this._rawHeaderNames || {};
      this._rawHeaderNames[field.toLowerCase()] = field;

      _addHeaderLine.call(this, field, value);
    };

    incoming.body = null;
    incoming.getBody = that.argo._getBody();
    incoming._argoModified = true;
  }

  var serverResponse = http.ServerResponse.prototype;
  if (!serverResponse._argoModified) {
    serverResponse.body = null;
    serverResponse.getBody = that.argo._getBody();

    serverResponse._argoModified = true;
  }
};
