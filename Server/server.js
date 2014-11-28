var express = require('express');
var http = require('http');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var WebSocket = require('faye-websocket');
var moment = require('moment');

// Load configuration file.
var config = require('./config.js');

// Logging function.
function LOGGER(message){
  if (config.log) console.log(message+config.logSep);
}

var slaves = {};

var port = config.PORT || 8000;
var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
//app.use(bodyParser.urlencoded());
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

app.post('/servers/:id', function(req, res) {
  slaves[req.params.id].socket.send(req.body);
  res.send();
});

app.post('/', function(req, res) {
  // send the message to all slaves
  for(var slave in slaves) {
      slaves[slave].socket.send(req.body);
  }
  res.send(200);
});

var server = app.listen(port, function() {
    LOGGER('Listening on port ' + server.address().port);
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
      LOGGER('New slave connected');
      ws.send('{"message": "Kneel before me slave!."}');
    });    

    // received a message from the client
    ws.on('message', function(event) {
      LOGGER('The slave said: ' + event.data);
    });

    // client disconnects from the server
    ws.on('close', function(event) {
      LOGGER('close', event.code, event.reason);
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