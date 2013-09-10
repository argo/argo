var http = require('http');

var Http = module.exports = function() {
};

Object.keys(http).forEach(function(k) {
  if (typeof http[k] === 'function') {
    Http.prototype[k] = http[k].bind(http);
  } else {
    Http.prototype[k] = http[k];
  }
});

Http.install = function(container) {
  container.register({
    name: 'argo.http',
    id: 'argo.http.node',
    value: Http,
    params: []
  });
};
