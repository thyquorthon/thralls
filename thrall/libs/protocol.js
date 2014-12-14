var vm = require('vm');

function cmd_exec(cmd, args, cb_stdout, cb_end) {
  var spawn = require('child_process').spawn,
    child = spawn(cmd, args),
    me = this;
  me.exit = 0;  // Send a cb to set 1 when cmd exits
  child.stdout.on('data', function (data) { cb_stdout(me, data) });
  child.stdout.on('end', function () { cb_end(me) });
}

// Protocol Functions definition
function Protocol(logger, cipher) {
  this.methods = [];
  logger = logger;
  cipher = cipher;
  this.methods['ack'] = function(payload, cb) {
  		msg = cipher.decrypt(payload.message);
		if (msg == "ACK") {
			logger.info('--> ACK:' + msg);
			cb({'error': false, 'send': false, 'result': null});
		} else {
			logger.error('--> NO_ACK: Invalid protocol passphrase : ' + msg);
			cb({'error': true, 'send': false, 'result': null});
		}
	};   
  this.methods['message'] = function(payload, cb) {
  		msg = cipher.decrypt(payload.message);
		logger.info('--> ' + msg);
		cb({'error': false, 'send': false, 'result': null});
	}; 
  this.methods['job'] = function(payload, cb) {
		logger.info('<-- JOB received');
		// SCRIPT JOB
		if (payload.script) {
			var script = vm.createScript(payload.script);
			logger.info('-*- executing SCRIPT JOB');
			try {
				result = script.runInThisContext();	
			} catch(error) {
				logger.info('-!- JOB failed');
				cb({'error': true, 'send': true, 'result': error + ' '});
			}
			logger.info('<-- SCRIPT JOB executed succesfully');
			cb({'error': false, 'send': true, 'result': result});
		}
		// CMD JOB
		if (payload.cmd) {
			logger.info('-*- executing CMD JOB');
			foo = new cmd_exec('cmd', ['dir'], 
  				function (me, data) {me.stdout += data.toString();},
  				function (me) {
  							   logger.info('<-- CMD JOB executed succesfully');
							   cb({'error': false, 'send': true, 'result': ms.stdout});}
			);
		} 
	};
}

// export the class
module.exports = Protocol;