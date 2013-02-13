# argo

Argo is an extensible, asynchronous API proxy and server.

argo offers:

* Asynchronous request and response pipelines.
* Reverse proxy to backend servers.
* Extensible package system.

## Example

Adding Cross-Origin Resource Sharing to an API You Don't Control

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

## Install

```bash
$ npm install argo
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
