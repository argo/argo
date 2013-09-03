var argo = require('../');

argo()
  .use(function(handle) {
    handle('error', function(env, error, next) {
      console.log(error.message);
      env.response.statusCode = 500;
      env.response.body = 'Internal Server Error';
      next(env);
      process.exit();
    });
  })
  .get('^/$', function(handle) {
    handle('request', function(env, next) {
      env.response.body = 'Hello World!';
      next(env);
    });
  })
  .get('^/explode$', function(handle) {
    handle('request', function(env, next) {
      setImmediate(function() { throw new Error('Ahoy!'); });
    });
  })
  .listen(process.env.PORT || 3000);
