//var app = require('express')();
var express = require('express');
var cookieParser = require('cookie-parser')
var app = express();
app.use(cookieParser());     // This is for cookies
var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 
var json = require('express-json');
app.use(json());       // to support JSON-encoded bodies
var crypto = require('crypto');


var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql     =    require('mysql');
var config    =    require('config');    // Taken from https://www.npmjs.com/package/config
//var tnfauth = require('./tnfauth.js');
var fs = require('fs');

//var authapi = require('./authapi.js');

//var dbmethods = require('./dbmethods.js');

global.logger = require('winston'); // this is for logging
logger.level = 'debug';

// Hash of the socket connections, key is the clientID and value is the socket object
var socketHash = {};


var chatDbConfig = config.get('chatdb.dbConfig');
global.pool      =    mysql.createPool(chatDbConfig);


var expressConfig = config.get('express');


// Get the configuration for the api server
GLOBAL.apiServerConfig = config.get('apiserver');

GLOBAL.requestConfig = config.get('request');



// Authenticator - basic authentication taken from http://blog.modulus.io/nodejs-and-express-basic-authentication
// Another link   https://davidbeath.com/posts/expressjs-40-basicauth.html
// We will be using this to auth a server against the controller, 
// but might choose not to use this as rather intensive
var basicAuth = require('basic-auth');


function handle_database(from,msg) {
    
  pool.getConnection(function(err,connection) {
    if (err) {
      connection.release();
      res.json({"code" : 100, "status" : "Error in connection database"});
      return;
    }   

    logger.debug('connected to db as id ' + connection.threadId);
        
    connection.query("select * from users",function(err,rows){
      connection.release();
      if(!err) {
        //res.json(rows);
        logger.debug(rows);
      }           
      else {
        logger.error("Error querying db: " + err);
      }
    });

    connection.on('error', function(err) {      
      res.json({"code" : 100, "status" : "Error in connection database"});
      return;     
    });

  });
}



function authClient(username, password, req, res) {

  authapi.queryAuthAPI(username, password, function(err, authJson) {

    if (!err) {
      if(authJson == null) {
        logger.error("Error, authJson is null");
      }
      else if("success" in authJson) {
        var successVal = authJson["success"];
        if(successVal == "true") {
          if("sessionid" in authJson) {
            var sessionID = authJson["sessionid"];
            logger.debug("This sessionID: " + sessionID);
            //res.cookie('chatcookie', sessionID, { maxAge: 3600, httpOnly: false });   // maxAge breaks this
            res.cookie('JSESSIONID', sessionID, { httpOnly: false });
            res.send( { "success": true } );
            res.status(200);
            adminProfile(sessionID);   // get the profile details for the admin
          }
          else {
            logger.error("sessionid not found in return json");
          }
        }
        else if(successVal == "false") {
          logger.error("Error, unable to authenticate user");
          res.status(404);
        }
        else{
          logger.error("Error, unable to determine success value: " + successVal);
          res.status(404);
        }
      }
    }
    else {
      var errMsg = null;
      if("message" in authJson) {
        errMsg = authJson.message;
      }
      logger.error("Error, unable to authenticate user, error message: " + errMsg);
      res.status(404);
      res.send(errMsg);
    }

  });

}


function insertDbSessionID(sessionID, adminID) {

  dbmethods.insertChatSession(sessionID, adminID, function(err, chatsessionID) {
    if(!err) {
      logger.debug("Have inserted into db chatsessionID: " + chatsessionID);
    }
    else {
      logger.error("Error attempting to insert sessionID into db for adminID: " + adminID);
    }
  });

}

// Get the admin profile information
function adminProfile(sessionID) {

  authapi.queryProfileAPI(sessionID, function(err, profileJson) {

    if (!err) {
      if(profileJson == null) {
        logger.error("Error, profileJson is null");
      }
      else {
        var adminJson = {};
        if("profile" in profileJson) {
          // get the profile in the Json
          adminJson = profileJson.profile;
          logger.debug("adminJson: " + JSON.stringify(adminJson));
        }
        var adminID = null;
        if("sTarget_AdminID" in adminJson) {
          adminID = adminJson.sTarget_AdminID;
          insertDbSessionID(sessionID, adminID);   // insert the session into the database
        }
        else {
          logger.error("adminID not found in adminJson");
        }
      }
    }
    else {
      var errMsg = null;
      if("message" in profileJson) {
        errMsg = profileJson.message;
      }
      logger.error("Error, unable to get profile details for user, error message: " + errMsg);
      //res.status(404);
      //res.send(errMsg);
    }

  });

}

/*
app.get('/', function(req, res){
  res.sendfile('index.html');
});
*/

// This is for authentication
/*
app.post("/login", function(req, res) {
    logger.debug("Have received a login request." + req.body);
    if(req.body.username && req.body.password) {
        logger.debug("username: " + req.body.username);
        authClient(req.body.username, req.body.password, req, res);
    }
});
*/

io.on('connection', function(socket) {
  logger.debug('a user connected');

  socket.on('message', function(message) {
    // Adapted from the following link to be able to send a cookie thru when connecting. 
    // http://stackoverflow.com/questions/4753957/socket-io-authentication
    logger.debug("Have received a message: " + JSON.stringify(message));
    if(message.JSESSIONID) {
      logger.debug("JSESSIONID: " + message.JSESSIONID);
    }
    if(message.rediskey) {
      logger.debug("rediskey: " + message.rediskey);
      // set the key of the socket
      socket.rediskey = message.rediskey;

      // Add the socket to the hash
      socketHash[message.rediskey] = socket;
    }
  });

  socket.on('disconnect', function(){
    logger.debug('user disconnected');
  });

  socket.on('data', function(from, msg, jsessionID){
    logger.debug('message: ' + msg + " from: " + from + " JSESSIONID: " + jsessionID);
    io.emit('chat message', msg);
    handle_database(from,msg);
    // Get the key of the socket
    logger.debug('Chat message by ', socket.rediskey);
  });
});


http.listen(expressConfig.port, function(){

  logger.info('listening on *:' + expressConfig.port);

});




