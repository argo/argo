#Quickstart

Argo is a node.js based API server. It can be used for proxying, or as an origin server.
It takes advantage of a bi-directional middleware model that allows you to granularly control
the flow of execution for request handling and the dispatching of responses. Below is
a Hello, World! sample in Argo.

```JavaScript
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
```

This sample simply responds to any request with a 200 status code, and `"Hello, World!"` as a response
body. There are a few things to take note of:

1. You can access the raw pipeline for incoming requests or outgoing responses using the `use` and `handle` functions.
2. Each middleware handler is passed two variables `env` and `next`.
  * `env`: Is the current environment bucket for the request. It will contain information on the request or any other functionality the developer can set.
  * `next`: Is a callback that should be called when execution in the particular middleware is complete. It will move on to the next stage in the pipeline.
3. `listen` simply mirrors the http server `listen()` function in nodejs. At minimum be sure to pass a port number into this function. 
