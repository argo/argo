# Argo

An extensible, asynchronous HTTP reverse proxy and origin server.

<!-- Argo is:

* An API-focused HTTP server.
* A reverse proxy to manage and modify HTTP requests and responses.
* Modular using handlers for request and response pipelines.
* Extensible using a package system.

As an API server:

* Route requests to handlers.
* Separate resources into modules.

As a reverse proxy:

* Route requests to backend servers.
* Transform HTTP messages on the fly.
* Add OAuth 2.0 support to an existing API.
* Create a RESTful API façade over legacy systems.
-->

## Examples

### Adding Cross-Origin Resource Sharing

Setup the server:

```javascript
var argo = require('argo');

argo()
  .use(function(handle) {
    handle('response', function(env, next) {
      env.response.setHeader('Access-Control-Allow-Origin', '*');
      next(env);
    });
  })
  .target('http://weather.yahooapis.com')
  .listen(1337);
```

Make a request:

```bash
$ curl -i http://localhost:1337/forecastrss?w=2467861

HTTP/1.1 200 OK
Date: Thu, 28 Feb 2013 20:55:03 GMT
Content-Type: text/xml;charset=UTF-8
Connection: keep-alive
Server: YTS/1.20.13
Access-Control-Allow-Origin: *
Content-Length: 2337

<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<GiantXMLResponse/>
```

### Serving an API Response 

Setup the server: 

```javascript
var argo = require('argo');

argo()
  .get('^/dogs$', function(handle) {
    handle('request', function(env, next) {
      env.response.statusCode = 200;
      env.response.body = { dogs: ['Alfred', 'Rover', 'Dino'] };
      next(env);
    });
  })
  .listen(1337);
```

Make a request:

```bash
$ curl -i http://localhost:1337/dogs

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 34 
Date: Thu, 28 Feb 2013 20:44:46 GMT
Connection: keep-alive

{"dogs":["Alfred","Rover","Dino"]}
```

## Install

```bash
$ npm install argo
```

## Documentation

* [handleFunction](#handleFunction)
* [use(handleFunction)](#usehandle)
* [use(package)](#usepackage)
* [target](#target)
* [route](#route)
* [get](#get)
* [post](#post)
* [put](#put)
* [del](#del)
* [options](#options)
* [trace](#trace)
* [map](#map)
* [include](#include)
* [listen](#listen)
* [Error Handling](#error-handling)


## Usage

<a name="handleFunction"/>
### handleFunction(type, [options], callback)

* `type`: `'request'` or `'response'`

* `options`: Mostly used for internal purposes.  Optional.

* `callback(env, next)`: A request or response callback. `env` is an environment context that is passed to every handler, and `next` is a reference to the next function in the pipeline.

When the handler is complete and wishes to pass to the next function in the pipeline, it must call `next(env)`.

<a name="usehandle"/>
### use(handleFunction)

`handleFunction` is used to set up request and response handlers.  

```javascript
argo()
  //For every request add 'X-Custom-Header' with value 'Yippee!'
  .use(function(handle) {
    handle('request', function(env, next) {
      env.request.headers['X-Custom-Header'] = 'Yippee!';
      next(env);
    });
  })
```
<a name="usepackage"/>
### use(package)

Alias for `include(package)`.

<a name="target"/>
### target(uri)

`target` is used for proxying requests to a backend server.

* `uri`: a string pointing to the target URI.

Example:

```javascript
argo()
  .target('http://weather.yahooapis.com')
```
<a name="route"/>
### route(path, [options], handleFunction)

* `path`: a regular expression used to match HTTP Request URI path.

* `options`: an object with a `methods` property to filter HTTP methods (e.g., `{ methods: ['GET','POST'] }`).  Optional.

* `handleFunction`: Same as in `use`.

Example:

```javascript
argo()
  .route('^/greeting$', function(handle) {
    handle('request', function(env, next) {
      env.response.statusCode = 200;
      env.response.headers = { 'Content-Type': 'text/plain' };
      env.response.body = 'Hello World!';
 
      next(env);
    });
  })
```
<a name="get"/>
<a name="post"/>
<a name="put"/>
<a name="del"/>
<a name="options"/>
<a name="trace"/>
### get(path, handleFunction)
### post(path, handleFunction)
### put(path, handleFunction)
### del(path, handleFunction)
### options(path, handleFunction)
### trace(path, handleFunction)

Method filters built on top of `route`.

Example:

```javascript
argo()
  .get('^/puppies$', function(handle) {
    handle('request', function(env, next) {
      env.response.body = JSON.stringify([{name: 'Sparky', breed: 'Fox Terrier' }]);
      next(env);
    });
  })
```
<a name="map"/>
### map(path, [options], argoSegmentFunction)

`map` is used to delegate control to sub-Argo instances based on a request URI path.

* `path`: a regular expression used to match the HTTP Request URI path.

* `options`: an object with a `methods` property to filter HTTP methods (e.g., `{ methods: ['GET','POST'] }`).  Optional.

* `argoSegmentFunction`: a function that is passed an instance of `argo` for additional setup.

Example:

```javascript
argo()
  .map('^/payments', function(server) {
    server
      .use(oauth)
      .target('http://backend_payment_server');
  })
```
<a name="include"/>
### include(package)

* `package`: An object that contains a `package` property.

The `package` property is a function that takes an argo instance as a paramter and returns an object that contains a `name` and an `install` function.

Example:

```javascript
var superPackage = function(argo) {
  return {
    name: 'Super Package',
    install: function() {
      argo
        .use(oauth)
        .route('^/super$', require('./super'));
    }
  };
};

argo()
  .include({ package: superPackage})
```
<a name="listen"/>
### listen(port)

* `port`: A port on which the server should listen.

<a name="error-handling"/>
### Error Handling

Argo allows a special `error` handler for capturing state when an uncaught exception occurs.

```javascript
argo()
  .use(function(handle) {
    handle('error', function(env, error, next) {
      console.log(error.message);
      env.response.statusCode = 500;
      env.response.body = 'Internal Server Error';
      next(env);
      process.exit();
    });
  })
  .get('^/$', function(handle) {
    handle('request', function(env, next) {
      env.response.body = 'Hello World!';
      next(env);
    });
  })
  .get('^/explode$', function(handle) {
    handle('request', function(env, next) {
      setImmediate(function() { throw new Error('Ahoy!'); });
    });
  })
  .listen(3000);
```

Unlike other named pipelines, there should be only one error handler assigned to an Argo server. It is recommended to exit the process once an error has been handled. This feature uses [domains](http://nodejs.org/api/domain.html).

See [`cluster.js`](https://github.com/argo/argo/blob/master/example/cluster.js) for an example of using error handling to restart workers in a cluster.

## Tests

Unit tests: 

```bash
$ npm test
```

Test Coverage:

```bash
$ npm run-script coverage
```

## License
MIT
