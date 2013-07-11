var pipeworks = require('pipeworks');

function Builder() {
  this._middleware = [];
  this._requestPipeline = pipeworks();
  this._responsePipeline = pipeworks();
  this.pipelineMap = {
    'request': this._requestPipeline,
    'response': this._responsePipeline,
  };
  this.app = null;
}

Builder.prototype.use = function(middleware) {
  this._middleware.push(middleware);
};

Builder.prototype.run = function(app) {
  this.app = app;
};

Builder.prototype.buildHandler = function eventedBuildHandler(event, options, handler) {
  if (!(event in this.pipelineMap)) {
    this.pipelineMap[event] = pipeworks();
  }

  this.pipelineMap[event].fit(options, handler);
};

Builder.prototype.build = function() {
  var handle = this.buildHandler.bind(this);
  this._middleware.forEach(function(middleware) {
    middleware(handle);
  });

  var pipeline = this._requestPipeline.fit(this.app).join(this._responsePipeline);

  return pipeline.build();
};

module.exports = Builder;
