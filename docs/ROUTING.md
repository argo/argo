#Routing

Argo allows for simple or complex RegEx based routing rules. A sample below will setup RegEx routes for multiple
types of request handlers for different verbs.

```JavaScript
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
```

Some things to note about this sample:
1. Argo allows you to wire up routing for specific route and verb combinations.
  * Each verb has a function `get`, `post`, `put`, `delete`, `options`
  * Verb functions functional similarly to middlewares. A `handle` function ensures that the request or response pipeline is properly wired up.
  * `map` allows you to embed routes in your argo app.
    * `map` takes two parameters. One is a RegEx based route, and the other is a function passing in a reference to the argo server
      * The `server` parameter to this function allows you to setup namespaced routes just like you would with top level argo.
      
