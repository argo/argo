var argo = require('../argo');

argo()
  .get('^/get/[0-9]+$', function(handle){
    handle('request', function(env, next){
      env.response.body = 'GET REQUEST!';
      env.response.statusCode = 200;
      next(env);
    });
  })
  .post('^/post/[0-9]+$', function(handle){
    handle('request', function(env, next){
      env.response.body = 'POST REQUEST!';
      env.response.statusCode = 200;
      next(env);
    });
  })
  .put('^/put/[0-9]+$', function(handle){
    handle('request', function(env, next){
      env.response.body = 'PUT REQUEST!';
      env.response.statusCode = 200;
      next(env);
    });
  })
  .del('^/delete/[0-9]+$', function(handle){
    handle('request', function(env, next){
      env.response.body = 'DELETE REQUEST!';
      env.response.statusCode = 200;
      next(env);
    });
  })
  .options('^/options/[0-9]+$', function(handle){
    handle('request', function(env, next){
      env.response.body = 'OPTIONS REQUEST!';
      env.response.statusCode = 200;
      next(env);
    });
  })
  .map('^/map$', function(server){
    server
      .use(function(handle){
        handle('request', function(env, next){
          env.response.body = 'Hello, from Map!';
          env.response.statusCode = 200;
          next(env);
        });
      });
  })
  .listen(3000);
