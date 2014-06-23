var argo = require('../argo');

argo()
  .map('^/map$', function(server){
    server
      .target('http://api.usergrid.com/mtraining/sandbox')
  })
  .target('https://api.usergrid.com/mdobson/sandbox')
  .listen(3000);
