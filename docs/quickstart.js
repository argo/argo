var argo = require('../argo');

argo()
  .use(function(handle){
    handle('request', function(env, next){
      console.log('Request Middleware');
      env.response.body = 'Hello, World!';
      env.response.statusCode = 200;
      next(env);
    });
  })
  .listen(3000);
