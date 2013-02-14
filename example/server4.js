var argo = require('../');
var cors = require('./cors');

argo()
  .use(cors)
  .get('/outer', function(addHandler) {
    addHandler('request', function(env, next) {
      env.response.body = 'Outer scope!';
      next(env);
    });
  })
  .map('/web', function(web) {
    web 
      .use(function(addHandler) {
        console.log('000YEAHBUDDYDOINIT');
        addHandler('response', function(env, next) {
          console.log('YEAHBUDDYDOINIT');
          env.response.headers['X-Stuff'] = 'Yep';
          next(env);
        });
      })
      .get('/greeting', function(addHandler) {
        addHandler('request', function(env, next) {
          env.response.body = 'Hello, world!';
          next(env);
        }); 
      });
  })
  .listen(process.env.PORT || 3000);
