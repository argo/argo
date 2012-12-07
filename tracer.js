module.exports = function(addHandler) {
  addHandler('request', function(env, next) {
    env.printTrace = function(name, message) {
      var request = env.request;
      var response = env.response;
      var target = env.target;

      var log = {
        name: name,
        timestamp: new Date(),
        message: message,
        env: {
          request: {
            method: request.method,
            url: request.url,
            headers: request.headers,
            body: request.body
          },
          response: {
            statusCode: response.statusCode,
            url: response.url,
            headers: response.headers,
            body: response.body
          }
        }
      };
      
      console.log('TRACE: ' + JSON.stringify(log));
    };
    env.trace = function(name, cb) {
      var start = +Date.now();
      cb();
      var message = 'Duration (' + name + '): ' + (+Date.now() - start) + 'ms';
      env.printTrace(name, message);
    };

    next(env);
  });
};
