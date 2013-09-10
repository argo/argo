var BodyHelper = module.exports = function() {
};

BodyHelper.install = function(container) {
  container.register({
    name: 'argo.body_helper',
    id: 'argo.body_helper.default',
    value: BodyHelper,
    params: []
  });
};

BodyHelper.prototype.init = function(argo) {
  var proto = argo.__proto__;
  
  proto._getBody = this._getBody;
};

BodyHelper.prototype._getBody = function() {
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
