var express = require('express');
var http = require('http');
var path = require('path');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var WebSocket = require('faye-websocket');
var moment = require('moment');

// Load configuration file.
var config = require('./config/config.json');
// Logger
var log4js = require('log4js');
log4js.configure('./config/log4js_config.json', { reloadSecs: 300 });
var logger = log4js.getLogger('thrall');
logger.setLevel(config.logLevel);

var slaves = {};

var port = config.PORT || 8000;
var app = express();

app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.startTime = moment();

app.get('/status', function(req, res) {
  res.send({'status':'ok', 'uptime': app.startTime.fromNow() });
});

app.get('/servers', function(req, res) {
  returnSlaves = [];
  for(var slave in slaves) {
      returnSlaves.push(slave);
  }
  res.send(returnSlaves);
});

app.get('/servers/:id', function(req, res) {
  temp = slaves[req.params.id].server
  temp.uptime = temp.connectionStart.fromNow();
  res.send(temp);
});

app.post('/servers/:id/messages', function(req, res) {
  msg = {'type':'message', 'message': req.body.message}
  slaves[req.params.id].socket.send(JSON.stringify(msg));
  res.send()
});

app.post('/servers/:id/jobs', function(req, res) {
  msg = {'type':'job', 'script': req.body.script}
  slaves[req.params.id].socket.send(JSON.stringify(msg));
  res.send()
});

app.post('/', function(req, res) {
  // send the message to all slaves
  for(var slave in slaves) {
      slaves[slave].socket.send(req.body);
  }
  res.send(200);
});

var server = app.listen(port, function() {
    logger.info('Listening on port ' + server.address().port);
});

server.on('upgrade', function(request, socket, body) {
  if (WebSocket.isWebSocket(request)) {
    serverName = request.headers.servername;
    var ws = new WebSocket(request, socket, body);
    // store the socket so we can contact it when a message comes in
    slaves[serverName] = { 'server' : {'serverName': serverName,
                                       'connectionStart': moment()},
                           'socket': ws}

    // new client connects to the server
    ws.on('open', function(event) {
      logger.info('New slave connected');
      ws.send('{"type": "message", "message": "Kneel before me slave!."}');
    });    

    // received a message from the client
    ws.on('message', function(event) {
      logger.info('The slave said: ' + event.data);
    });

    // client disconnects from the server
    ws.on('close', function(event) {
      logger.info('close', event.code, event.reason);
      delete slaves[serverName];
      ws = null;
    });
  }
});

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers
// will print stacktrace
app.use(function(err, req, res, next) {
    res.send('error', {
        message: err.message,
        error: err
    });
});

module.exports = app;