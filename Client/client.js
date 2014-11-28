var os = require('os');
var WebSocket = require('faye-websocket');
var http = require('http');

// Logging function.
function LOGGER(message){
	if (config.log) console.log(message+config.logSep);
}

// CONNECT FUNCTION
function connect(){
	options = {'headers': {
		'serverName': os.hostname()
	}}
	ws = new WebSocket.Client('ws://' + config.MASTER, null, options);
	// Slave protocol.
	ws.on('message', function(event) {
	  LOGGER('--> ' + event.data.message);
	  // send a receipt back to the server
	  //ws.send('Got the message on port ' + port + '. Thanks!!');
	});
	// lost socket handling.
	ws.on('close', function(event) {
	  LOGGER('--/ Connection lost.');
	  LOGGER('<-- Retry Connection.');
	  conn.ws  = connect();
	});
	return ws;
}

// Load configuration file.
var config = require('./config.js');
if (typeof config.MASTER == 'undefined') throw new Error('No master defined in configuration');
LOGGER('CONFIGURATION FILE LOADED');
// Connect to master.
LOGGER('CONNECTING');
var conn = {}
conn.ws  = connect();
LOGGER('CONNECTED TO ' + config.MASTER);

// Raise slave.
var port = config.PORT || 8001;
var server = http.createServer().listen(port);
LOGGER('SLAVE ON PORT ' + port);
