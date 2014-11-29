var os = require('os');
var WebSocket = require('faye-websocket');
var http = require('http');
var protocol = require('./protocol');

// CONNECT FUNCTION
function connect(){
	options = {'headers': {
		'serverName': os.hostname()
	}}
	ws = new WebSocket.Client('ws://' + config.MASTER, null, options);
	// Slave protocol.
	ws.on('message', function(event) {
	  //logger.info('--> ' + event.data);
	  data = JSON.parse(event.data);
	  msg = {'id': data.id, 'type': data.type, 'status': 'received'};
	  ws.send(JSON.stringify(msg));
	  outcome = actions.methods[data.type](data);
	  if (outcome.send) {
	  	msg.result = outcome.result;
	  	if (outcome.error) msg.status = 'error'; else msg.status = 'done';
	  	// send a receipt back to the server
	  	ws.send(JSON.stringify(msg));
	  }
	  
	  
	});
	// lost socket handling.
	ws.on('close', function(event) {
	  logger.info('-|- Connection lost.');
	  logger.info('<-- Retry Connection.');
	  conn.ws  = connect();
	});
	return ws;
}

// Load configuration file.
var config = require('./config/config.json');
if (typeof config.MASTER == 'undefined') throw new Error('No master defined in configuration');
var log4js = require('log4js');
log4js.configure('./config/log4js_config.json', { reloadSecs: 300 });
var logger = log4js.getLogger('thrall');
logger.setLevel(config.logLevel);
// Actions 
actions = new protocol(logger);

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
