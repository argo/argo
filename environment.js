function Environment() {
  this.request = null;
  this.response = null;
  this.target = {};
  this.argo = {};
}

module.exports = function(proxy, req, res) {
  var env = new Environment();
  env.request = req;
  env.response = res;
  env.pipeline = proxy._pipeline.bind(proxy);
  return env;
}
