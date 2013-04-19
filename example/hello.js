var argo = require('../');

argo()
  .use(function(handle) {
    handle('request', function(env, next) {
      env.response.statusCode = 200;
      env.response.setHeader('Content-Type', 'text/plain');
      env.response.body = 'Hello World';

      next(env);
    });
  })
  .listen(process.env.PORT || 3000);
