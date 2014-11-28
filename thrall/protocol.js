var vm = require('vm');

// class methods
message = function(payload) {
	_self.logger.info('--> ' + payload.message)
};

job = function(payload) {
	_self.logger.info('--> executing JOB');
	var script = vm.createScript(payload.script);
	script.runInThisContext();
	_self.logger.info('JOB executed.');
};


// Protocol Functions definition
function Protocol(logger) {
  _self = this
  this.methods = [];
  this.logger = logger;
  this.methods['message'] = message;
  this.methods['job'] = job;
}

// export the class
module.exports = Protocol;