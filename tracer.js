var uuid = require('node-uuid');

module.exports = function(addHandler) {
  addHandler('request', { hoist: true }, function(env, next) {
    env.requestId = uuid.v4();
    env.sequenceNumber = 0;
    env.printTrace = function(name, message, extra) {
      var request = env.request;
      var response = env.response;
      var target = env.target;

      var log = {
        name: name,
        requestId: env.requestId,
        sequenceNumber: ++env.sequenceNumber,
        timestamp: new Date(),
        message: message,
        env: {
          request: {
            method: request.method,
            url: request.url,
            headers: request.headers,
            body: (request.body && request.body.toString) ? request.body.toString() : null
          },
          response: {
            statusCode: response.statusCode,
            url: response.url,
            headers: response._headers,
            body: (response.body && response.body.toString) ? response.body.toString() : null
          }
        }
      };

      if (extra) {
        Object.keys(extra).forEach(function(key) {
          if (extra.hasOwnProperty(key)) {
            log[key] = extra[key];
          }
        });
      }
      
      console.log('TRACE: ' + JSON.stringify(log));
    };
    env.trace = function(name, cb) {
      var start = +Date.now();
      cb();
      var duration = (+Date.now() - start); 
      var message = 'Duration (' + name + '): ' + duration + 'ms';
      env.printTrace(name, message, { duration: duration });
    };

    next(env);
  });
};
