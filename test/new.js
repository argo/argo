var argo = require('../');

argo()
  .get('^/hello$', function(handle) {
    handle('request', function(env, next) {
      env.response.body = 'Hello world.';
      next(env);
    });
  })
  .map('^/hola', function(server) {
    server.get('^/world$', function(handle) {
      console.log('calling munda handler');
      handle('request', function(env, next) {
        env.response.body = 'Hello world en espanol!';
        next(env);
      });
    });
  })
  .listen(3000);

