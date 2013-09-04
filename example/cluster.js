var cluster = require('cluster');
var http = require('http');
var os = require('os');
var argo = require('../');
var workerServer = require('./worker');

var worker = function(server) {
  return argo()
    .use(function(handle) {
      handle('error', function(env, error, next) {
        server.close(); // stop taking requests
        cluster.worker.disconnect(); // communicate to master

        console.log('Token:', env.token); // capture state on errors
        console.log('Error:', error.message);

        env.response.statusCode = 500;
        env.response.body = 'Internal Server Error';

        next(env); // continue to respond to this request
      });
    })
    .map('*', workerServer);
};

if (cluster.isMaster) {
  for (var i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }

  cluster.on('disconnect', function(worker) {
    console.log('Worker', worker.process.pid, 'died!');
    cluster.fork(); // restart
  });
} else {
  var server = http.createServer();
  var handler = worker(server).build();

  server.on('request', handler.run);
  server.listen(process.env.PORT || 3000);
}
