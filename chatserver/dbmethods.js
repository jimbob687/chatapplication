
module.exports = {

  insertChatSession: function(jsessionid, clientID, callback) {
    
    pool.getConnection(function(err,connection) {
      if (err) {
        logger.info("Error, unable to get database connection");
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
        return;
      }   

      connection.query('INSERT INTO chatsessions (jsessionid, clientID, expiretime) VALUES (?,?,(now() + INTERVAL ? SECOND))', [jsessionid, clientID, sessionConfig.maxagesecs], function(err,result) {
        connection.release();
        if(!err) {
          var chatsessionID = result.insertId;    // key for the record that has just been inserted
          callback(false, chatsessionID);
        }           
        else {
          logger.error("Error inserting chatsession into db: " + err);
          callback(true, err);
          return;
        }
      });

      connection.on('error', function(err) {      
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
        return;
      });

    });
  },


  // Function to associate a chat session with a server, should only be used when a new connection is established
  // chatserverID - ID of the server
  // chatsessionID - ID of the chat session
  insertSessionServer: function(chatserverID, chatsessionID, callback) {
    
    pool.getConnection(function(err,connection){

      if (err) {
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
        return;
      }   

      // invalidate any existing associations for the chat session with other servers
      connection.query('UPDATE sessionserver (status, inactive_date) VALUES (?,?) WHERE chatsessionID = ? AND status = ?', ['inactive', NOW(), chatsessionID, 'active'], function(err,result) {

        if(!err) {
          connection.query('INSERT INTO sessionserver (chatserverID, chatsessionID, status) VALUES (?,?,?)', [jsessionid, clientID, 'active'], function(err,result) {
            connection.release();
            if(!err) {
              var sessionserverID = result.insertId;    // key for the record that has just been inserted
              callback(false, sessionserverID);
              return;
            }           
            else {
              logger.error("Error inserting session server into db: " + err);
              callback(true, err);
              return;
            }
          });
        }

        connection.on('error', function(err) {      
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res);
          return;
        });

      });

    });
  },


  // Query the database for a sessionID details
  querySessionID: function(jsessionid, callback) {

    pool.getConnection(function(err,connection) {
      if (err) {
        var res = {"code" : 100, "status" : "Error in connection database"};
        return;
      }   

      connection.query('SELECT chatsessionid,jsessionid, clientID, created, expiretime FROM chatsessions WHERE jsessionid = ?', [jsessionid], function(err, rows) {
        connection.release();
        if(!err) {
          var connectionDetails = {};
          callback(false, rows);
          return;
        }
        else {
          logger.error("Error querying database for sessionID information: " + err);
          callback(true, err);
          return;
        }
      });

      connection.on('error', function(err) {      
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res)
        return;
      });

    });
  }
  

}

