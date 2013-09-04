var argo = require('../');

argo()
  .use(function(handle) {
    handle('custom', function(env, next) {
      env.response.setHeader('X-Handler', 'custom');
      next(env);
    });
  })
  .use(function(handle) {
    handle('request', function(env, next) {
      env.pipeline('custom').siphon(env, next);
    });
  })
  .get('^/$', function(handle) {
    handle('request', function(env, next) {
      env.response.body = 'Hello Custom!';
      next(env);
    });
  })
  .listen(process.env.PORT || 3000);
