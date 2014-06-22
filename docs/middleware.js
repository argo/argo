var argo = require('../argo');

argo()
  .use(function(handle){
    handle('request', function(env, next){
      console.log('Request Middleware');
      env.response.body = 'Hello!';
      env.response.statusCode = 200;
      next(env);
    });
    handle('response', function(env, next){
      console.log('Response Middleware');
      env.response.body += ' World!';
      next(env);
    });
  })
  .listen(3000);
