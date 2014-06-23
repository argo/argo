#Proxying

Argo allows you to setup API proxying rules as well. Below illustrates a few ways to setup proxies.

```JavaScript
var argo = require('../argo');

argo()
  .map('^/map$', function(server){
    server
      .target('http://api.usergrid.com/mtraining/sandbox')
  })
  .target('https://api.usergrid.com/mdobson/sandbox')
  .listen(3000);
```

A few things to note about this sample:
1. The `target` function will wire up proxy functionality for you. It will take care of the heavy lifting of putting together the backend server URL, and routing it to the specific server accordingly.
2. You can embed `target` functions under namespaces using `map`. It will still put everything together accordingly, but this will allow you to namespace proxies under routes.
