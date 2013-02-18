# Argo

An extensible, asynchronous HTTP reverse proxy and origin server.

Argo is:

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


## Examples

### Adding Cross-Origin Resource Sharing

Setup the server:

```javascript
var argo = require('argo-server');

argo()
  .use(function(addHandler) {
    addHandler('response', function(env, next) {
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
```

### Serving an API Request

Setup the server: 

```javascript
var argo = require('argo-server');

argo()
  .get('/dogs', function(addHandler) {
    addHandler('request', function(env, next) {
      env.response.statusCode = 200;
      env.response.headers = { 'Content-Type': 'application/json' };
      env.responseBody = JSON.stringify(['Alfred', 'Rover', 'Dino']);

      next(env);
    });
  })
  .listen(1337);
```

Make a request:

```bash
$ curl -i http://localhost:1337/dogs
```

## Install

```bash
$ npm install argo-server
```

## Usage

### .use(1)
### .target(1)
### .route(2)
### .map(2)
### .include(1)

## Tests

Unit tests: 

```bash
$ npm test
```

Test Coverage:

```bash
$ npm run-script coverage
```

## On the Roadmap

* HTTP Caching Support
* Collapsed Forwarding
* Parameterized Routing
* Rate Limiting

## License
MIT
