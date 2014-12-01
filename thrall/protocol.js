var vm = require('vm');
// class methods
message = function(payload) {
	_self.logger.info('--> ' + payload.message);
	return {'error': false, 'send': false, 'result': null};
};

job = function(payload) {
	_self.logger.info('<-- JOB received');
	var script = vm.createScript(payload.script);
	_self.logger.info('-*- executing JOB');
	try {
		result = script.runInThisContext();	
	} catch(error) {
		_self.logger.info('-!- JOB failed');
		return {'error': true, 'send': true, 'result': error + ' '};
	}
	_self.logger.info('<-- JOB executed succesfully');
	return {'error': false, 'send': true, 'result': result};
};


// Protocol Functions definition
function Protocol(logger) {
  _self = this;
  this.methods = [];
  this.logger = logger;
  this.methods['message'] = message;
  this.methods['job'] = job;
}

// export the class
module.exports = Protocol;