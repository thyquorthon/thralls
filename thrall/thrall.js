var crypto = require('crypto');
var fs = require('fs');
var os = require('os');
var WebSocket = require('faye-websocket');
var http = require('http');
var Protocol = require('./libs/protocol');
var Crypt = require('./libs/crypt');
var result = null;

// CONNECT FUNCTION
connect = function(){
	options = {'headers': {
		'serverName': os.hostname(),
		'CSRFToken': getToken()
	}}
	ws = new WebSocket.Client(config.protocol + '://' + config.MASTER, null, options);
	// Slave protocol.
	ws.on('message', function(event) {
	  data = JSON.parse(event.data);
	  msg = {'id': data.id, 'type': data.type, 'status': 'received'};
	  ws.send(JSON.stringify(msg));
	  logger.error("YEAH " + JSON.stringify(data))
	  actions.methods[data.type](data, function(outcome) {
	  	logger.error("QWEQE " + JSON.stringify(outcome))
	    if (outcome.send) {
		  	logger.error("CIPOTE "+ outcome.result)
		  	msg.result = outcome.result;
		  	if (outcome.error) msg.status = 'error'; else msg.status = 'done';
		  	// send a receipt back to the server
		  	ws.send(JSON.stringify(msg));
	  	}
	  });
	});
	// lost socket handling.
	ws.on('close', function(event) {
	  logger.info('-|- Connection lost.');
	  logger.info('<-- Retry Connection.');
	  conn.ws  = connect();
	});
	return ws;
}

getToken = function(){
	passphrase = crypto.randomBytes(20).toString('hex');
	token = cipher.encrypt("token"+passphrase);
  return token;
}

// Load configuration file.
var config = require('./config/config.json');
if (typeof config.MASTER == 'undefined') throw new Error('No master defined in configuration');
var log4js = require('log4js');
log4js.configure('./config/log4js_config.json', { reloadSecs: 300 });
var logger = log4js.getLogger('thrall');
logger.setLevel(config.logLevel);
// Cipher
cipher = new Crypt(logger, config.secret);
// Actions 
actions = new Protocol(logger, cipher);
//logger.error(cipher.encrypt)


logger.info('CONFIGURATION FILE LOADED');
// Connect to master.
logger.info('CONNECTING');
var conn = {}
conn.ws  = connect();
logger.info('CONNECTED TO ' + config.MASTER);

// Raise slave.
var port = config.PORT || 8001;
var server = http.createServer().listen(port);
logger.info('SLAVE ON PORT ' + port);


function cmd_exec(cmd, args, cb_stdout, cb_end) {
  var spawn = require('child_process').spawn,
    child = spawn(cmd, args),
    me = this;
  me.exit = 0;  // Send a cb to set 1 when cmd exits
  child.stdout.on('data', function (data) { cb_stdout(me, data) });
  child.stdout.on('end', function () { cb_end(me) });
}

cmd_exec("cmd", ["dir"],
			function (me, data) {me.stdout += data.toString();},
  			function (me) {logger.info('<-- CMD JOB executed succesfully'); 
  							//cb({'error': false, 'send': true, 'result': ms.stdout});
  						}
			)