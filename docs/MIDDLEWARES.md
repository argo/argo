#Quickstart

Argo takes advantage of a bi directional middleware model. It allows you to setup execution
pipelines for incoming requests and outgoing responses.

```JavaScript
var argo = require('argo');

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
```

Above is a basic middleware sample for argo. Here are some things to take note of:

1. `use` queues up a middleware for usage by argo. It takes a function which has a `handle` callback passed into it.
2. `handle` allows you to setup pipelines for execution.
  * `handle` takes two parameters. A pipeline name (typically `"request"`, `"response"`, or `"error"`), and a function as a handler for the middleware pipeline.
  * `"request"` Handles incoming requests to the server. These are executed in the order of their setup with the `use` function.
  * `"response"` Handles outgoing responses from the server. These are executed in reverse order of their setup with the `use` function.
  * `"error"` is an error handling pipeline. If an error occurs in that middleware then this handler is executed.
  * The second argument is a function that is executed for that particular middleware. It takes an `env` argument containing request and response data, and a function
  called `next` that will handle moving to the next stage in that particular execution pipeline.
