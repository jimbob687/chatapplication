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

var authapi = require('./authapi.js');
var searchapi = require('./searchapi.js');

var dbmethods = require('./dbmethods.js');

global.logger = require('winston'); // this is for logging
logger.level = 'debug';

// Hash of the socket connections, key is the clientID and value is the socket object
var socketClientHash = {};
// Hash of the socket connections, key is the JSESSIONID and value is the clientID e.g. { JSESSIONID1: 6576, JSESSIONID2: 9845 }
var socketSessionHash = {};


var chatDbConfig = config.get('chatdb.dbConfig');
global.pool      =    mysql.createPool(chatDbConfig);

/* Taken out for now as not using this
var fedDbConfig = config.get('feddb.dbConfig');
global.fedpool   =    mysql.createPool(fedDbConfig);
*/

global.sessionConfig = config.get('session');

var expressConfig = config.get('express');

// Central controller server information to form a connection
var controllerConfig = config.get('controller');

// Get the configuration for the api server
GLOBAL.apiServerConfig = config.get('apiserver');

GLOBAL.requestConfig = config.get('request');



// This is to connect to a remote controller server
// http://stackoverflow.com/questions/8837236/how-to-connect-two-node-js-servers-with-websockets
// http://stackoverflow.com/questions/14118076/socket-io-server-to-server/14118102#14118102
// http://stackoverflow.com/questions/14118076/socket-io-server-to-server/14118102#14118102    this one works, requires protocol
var controllerURL = controllerConfig.protocol + "://" + controllerConfig.serverhostname + ":" + controllerConfig.serverport
logger.info("controllerURL: " + controllerURL);
var iocontroller = require('socket.io-client')
//var socketcontroller = iocontroller.connect('http://127.0.0.1:3001', {reconnect: true});
var socketcontroller = iocontroller.connect(controllerURL, {reconnect: true});

logger.info("About to try to create a socket connection");
// Add a connect listener
socketcontroller.on('connect', function(socketcontroller) { 
  logger.info('Connected!');
});



/*
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
*/


// queryProfileAPI: function(username, password, jesessionid, callback)

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
            adminProfile(sessionID, null);   // get the profile details for the admin
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


function insertDbSessionID(sessionID, clientID) {

  dbmethods.insertChatSession(sessionID, clientID, function(err, chatsessionID) {
    if(!err) {
      logger.debug("Have inserted into db chatsessionID: " + chatsessionID);
    }
    else {
      logger.error("Error attempting to insert sessionID into db for clientID: " + clientID);
    }
  });

}

/*
 * Get the admin profile information
 * sessionID - is the JSESSIONID that we are making the query for
 * socket - is the socket that the request came in on, if is null then sessionID didn't come in on a socket
*/
function adminProfile(sessionID, socket) {

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
        var clientID = null;
        if("sTarget_AdminID" in adminJson) {
          clientID = adminJson.sTarget_AdminID;
          insertDbSessionID(sessionID, clientID);   // insert the session into the database
        }
        else {
          logger.error("clientID not found in adminJson");
        }

        if(clientID !== null) {
          // add the sessionID to the hash
          socketSessionHash[sessionID] = clientID;

          // build a hash and add the clientId to the main hash
          var clientHash = {};
          clientHash["sessionID"] = sessionID;
          var sessionExpire = Math.floor(Date.now() / 1000) + sessionConfig.maxagesecs;
          clientHash["expire"] = sessionExpire;
          if(socket !== null) {
            // we have a socket with this
            clientHash["socket"] = socket;
          }
          socketClientHash[clientID] = clientHash;   // add to the hash
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
 * Function to get the details of the session from the db based on the sessionID that has been receieved
 * sessionID - JSESSIONID that has been received
 * socket - socket that the connection is for
 */
function searchSessionID(sessionID, socket, dataHash, callback) {

  // query the db for the details of the sessionID
  dbmethods.querySessionID(sessionID, function(err, rows) {

    if(!err) {
      logger.info("Have got: " + rows.length + " rows for sessionID: " + sessionID);
      if(rows == null) {

      }
      else if(rows.length == 0) {
        // no results returned, we need to call the api server for client details
        adminProfile(sessionID, socket);
      }
      else if(rows.length > 1) {
        // should only have max 1 row returned, this is an error
      }
      else if(rows.length == 1) {
        var clientID = rows[0].clientID;  // get the clientID that was returned
        // add the sessionID to the hash
        socketSessionHash[sessionID] = clientID;

        var clientHash = {};
        // we have got details of the user
        var resultRow = rows[0];

        clientHash["sessionID"] = sessionID;

        if(socket !== null) {
          clientHash["socket"] = socket;
        }
        
        if("clientID" in resultRow) {
          socketClientHash[resultRow.clientID] = clientHash;
          if(socket != null) {
            logger.debug("Setting the socket clientid: " + resultRow.clientID);
            socket.clientid = resultRow.clientID;     // add the clientID to to the socket
          }
        }
        else {
          logger.info("Unable to find the clientID");
        }
        callback(sessionID, socket, dataHash);    // send off to get processed
      }
    }

  });

}


/*
 * Process a message that has been received
*/
function processMessage(sessionID, socket, dataHash) {
  var message = null;
  if("message" in dataHash) {
    message = dataHash.message;
  }
  
  // This will send to message back to the client
  io.emit('chat message', dataHash.message);
}


/*
 * Function to process the incoming message, is assumed that we know who the socket belongs to
 * sessionID - the JSESSIONID 
 * socket - socket of the server
 * dataHash - Hash of the session
*/
function processData(sessionID, socket, dataHash) {

  logger.info("In processData");

  if("type" in dataHash) {
    if(dataHash.type == "message") {
      logger.debug('processing a message');
      processMessage(sessionID, socket, dataHash);
    }
    else {
      logger.error("Error, unrecognized datatype: " + dataHash.type);
    }
  }

}


/*
 * To perform an autocomplete on a client name to start or add to a conversation
 *
*/
function clientNameSearch(sessionID, socket, dataHash) {
  var term = null;
  if("term" in dataHash) {
    term = dataHash.term;
  }

  searchapi.searchClientNameAPI(sessionID, term, function(err, returndata) {
    logger.info("Callback has been completed");
  });

}


app.get('/', function(req, res){
  res.sendfile('index.html');
});

// This is for authentication
app.post("/login", function(req, res) {
    logger.debug("Have received a login request." + req.body);
    if(req.body.username && req.body.password) {
        logger.debug("username: " + req.body.username);
        authClient(req.body.username, req.body.password, req, res);
    }
});

io.on('connection', function(socket) {
  logger.debug('a user connected');

  socket.on('data', function(dataHash, jsessionID) {
    logger.info("dataHash: " + JSON.stringify(dataHash));

    // Adapted from the following link to be able to send a cookie thru when connecting. 
    // http://stackoverflow.com/questions/4753957/socket-io-authentication
    if("clientid" in socket) {
      logger.info("clientid of socket: " + socket.clientid);
      processData(sessionID, socket, dataHash);
    }
    else {
      logger.debug("Socket doesn't have a clientid so need to get from the db");
      searchSessionID(jsessionID, socket, dataHash, processData);
    }

  });
 

  socket.on('clientlookup', function(dataHash, jsessionID) {
    logger.info("Have just got an autocomplete request: " + JSON.stringify(dataHash));
    clientNameSearch(jsessionID, socket, dataHash);
  });


  socket.on('disconnect', function(){
    logger.debug('user disconnected');
  });


});


http.listen(expressConfig.port, function(){
  logger.info('listening on *:' + expressConfig.port);

  app.use('/css', express.static(__dirname + '/css'));
  app.use('/js', express.static(__dirname + '/js'));
  app.use('/fonts', express.static(__dirname + '/fonts'));

});




