# Argo

An extensible, asynchronous HTTP reverse proxy and origin server.

Argo is:

* An API-focused HTTP server.
* A reverse proxy to manage and modify HTTP requests and responses.
* Modular using handlers for request and response pipelines.
* Extensible using a package system.

Argo as an API server:

* Route requests to handlers.
* Separate resources into modules.

Argo as an API reverse proxy:

* Route requests to backend servers.
* Transform HTTP messages on the fly.
* Add OAuth 2.0 support to an existing API.
* Create a RESTful API façade over legacy systems.

On the Roadmap:

* HTTP Caching Support
* Collapsed Forwarding
* Parameterized Routing
* Rate Limiting

## Example

Adding Cross-Origin Resource Sharing

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

```bash
$ curl -i http://localhost:1337/forecastrss?w=2467861
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

## License
MIT
