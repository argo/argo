var argo = require('../');

argo()
  .target('http://localhost:8080')
  .listen(process.env.PORT || 3000);
