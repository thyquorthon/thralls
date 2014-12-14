// ******************************************************************************
// Requires
// ******************************************************************************
var os = require('os');
var express = require('express');
var http = require('http');
var path = require('path');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var WebSocket = require('faye-websocket');
var moment = require('moment');
var DBEngine = require('tingodb')();
var fs = require('fs');
var Crypt = require('./libs/crypt');

// ******************************************************************************
// CONFIG
// ******************************************************************************
var config = require('./config/config.json');

// ******************************************************************************
// LOGGER
// ******************************************************************************
var log4js = require('log4js');
log4js.configure('./config/log4js_config.json', { reloadSecs: 300 });
var logger = log4js.getLogger('thrall');
logger.setLevel(config.logLevel);

// ******************************************************************************
// DATABASE
// ******************************************************************************
if (!fs.existsSync(config.dbStore)) fs.mkdirSync(config.dbStore);
var db = new DBEngine.Db(config.dbStore, {});

// ******************************************************************************
// LIBS
// ******************************************************************************
cipher = new Crypt(logger, config.secret);

// ******************************************************************************
// REST API ROUTES
// ******************************************************************************
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
  serverName = req.params.id;
  // Open Jobs Table.
  var jobs = db.collection('jobs', function(err, jobs){
    if (err) {res.send(500, {'error': 'Failed to open jobs table.'});}
    else {
      // Create a JOB on the DB.
      jobId = new DBEngine.ObjectID();
      /*newJob = {'id': jobId, 'type':'job', 'status': 'sent'};
      if (req.body.script) newJob.script = req.body.script;
      if (req.body.cmd) newJob.cmd = req.body.cmd;*/
      newJob = req.body;
      newJob.jobId = jobId; newJob.type = "job"; newJob.status = "sent";
      jobs.insert(newJob, function(err, job){
        if (err) { res.send(500, {'error': 'Failed to insert job in table.'});}
        else {
          slaves[serverName].socket.send(JSON.stringify(newJob));
          res.send(200, jobId);
        }
      });
    }
  });
});

app.get('/servers/:id/jobs', function(req, res) {
  serverName = req.params.id;
  var jobs = db.collection('jobs', function(err, jobs){
    if (err) {res.send(500, {'error': 'Failed to open jobs table.'});} else 
    {
      jobs.find({}).toArray(function(err, jobs2send){
        res.send(200, jobs2send);
      });
    }
  });
});

app.get('/servers/:id/jobs/:jobId', function(req, res) {
  serverName = req.params.id;
  jobId = req.params.jobId;
  // Open Jobs Table.
  var jobs = db.collection('jobs', function(err, jobs){
    if (err) { res.send(500, {'error': 'Failed to open jobs table.'});}
    else {
      // get the jobs from the DB.
      jobs.findOne({id:new DBEngine.ObjectID(jobId)}, function (err, job){
        if (err || !job) res.send(404, {'error': 'Not Found'}); else res.send(200, job);
      });
    }
  });
});

var server = app.listen(port, function() {
    logger.info('Listening on port ' + server.address().port);
});

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error({'error': 'Not Found'});
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

// ******************************************************************************
// SOCKET PROTOCOL
// ******************************************************************************
var slaves = {};

server.on('upgrade', function(request, socket, body) {
  if (WebSocket.isWebSocket(request)) {
    serverName = request.headers.servername;
    // GET / CREATE TOKEN
    connected = true;
    passphrase = cipher.decrypt(request.headers.csrftoken);

    // **
    if (passphrase.substring(0, 5)!="token"){
      logger.error("Failed to decrypt passphrase from : " + serverName);
      connected = false;
    }
    
    var ws = new WebSocket(request, socket, body);
    // store the socket so we can contact it when a message comes in
    slaves[serverName] = { 'server' : {'serverName': serverName,
                                       'connectionStart': moment()},
                           'socket': ws,
                           'passphrase': passphrase};

    // new client connects to the server
    ws.on('open', function(event) {
      if (connected) ws.send('{"type": "ack", "message": "' + cipher.encrypt("ACK") + '"}'); 
      else ws.send('{"type": "close", "message": "Invalid Call"}'); 
    });    

    // received a message from the client
    ws.on('message', function(event) {
      logger.info('The slave said: ' + event.data);
      // JOB HANDLING
      data = JSON.parse(event.data);
      if (data.type=='job') {
        updateJob(data);        
      }
    });

    // Thrall disconnected
    ws.on('close', function(event) {
      logger.info(serverName + ' disconnected. ', event.code, event.reason);
      delete slaves[serverName];
      ws = null;
    });
  }
});


// ******************************************************************************
// FUNCTIONS
// ******************************************************************************
updateJob = function(jobUpdate) {
    var jobs = db.collection('jobs', function(err, jobs){
    if (err) { logger.error('Failed to open jobs table.');}
    else {
      // get the jobs from the DB.
      jobs.findOne({id:new DBEngine.ObjectID(jobUpdate.id)}, function (err, job){
        if (err || !job) {logger.error('Job ' + jobUpdate.id + ' not found.');} 
        else {
          job.status = jobUpdate.status;
          job.result = jobUpdate.result;
          jobs.update({id:job.id}, job, {safe:true}, function(err, count){
            if (err) logger.error('Failed to update '+ job.id); else logger.info('Updated status "' + job.status + '" on job ' + job.id + ' -- ' + job.result);
          });
        }
      });
    }
  });
}


// ******************************************************************************
// ******************************************************************************
module.exports = app;