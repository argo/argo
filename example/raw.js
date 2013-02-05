var agent = require('webkit-devtools-agent');
var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World');
})
.listen(process.env.PORT || 3000);

console.log(process.pid);
