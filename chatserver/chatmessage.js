
/*
 * This module is for processing chat messages that have been received
 */

module.exports = {




}


/*
 * Function to increment the messge counter for a conversation in redis
 */
function incrementMsgCount(clientID, conversationID, callback) {

  try {

    var returnHash = {};

    var msgKey = _chatMsgCountKey + ":" + conversationID;   // key for the conversation that we are tracking

    _redisclient.get(msgKey, function(err, reply) {
      // get counter
      if(!err) {
        if(reply != null) {
          // now increment the counter
          _redisclient.incr(msgKey, function(err, reply) {
            if(!err) {
              logger.debug("Increment reply: " + reply);
            }
            else {
              logger.error("Error attempting to increment counter for conversationID: " + conversationID + " in redis. " + err);
            }
          }); 
        }
        else {
          // counter isn't in redis, need to add it by first querying the db
          _dbmethods.queryChatMessageCount(conversationID, function(err, messageCounter) {
             if(!err) {
               // add the counter to redis
               _redisclient.set(msgKey, messageCounter, function(err, reply) {
                 if(!err) {
                   // now increment the counter
                   _redisclient.incr(msgKey, function(err, reply) {
                     if(!err) {
                       logger.debug("Increment reply: " + reply);
                     }
                     else {
                       logger.error("Error attempting to increment counter for conversationID: " + conversationID + " in redis. " + err);
                     }
                   }); 
                 }
                 else {
                   logger.error("Error attempting to add counter to conversationID: " + conversationID + " into redis. " + err);
                   callback(true, null);
                 }
               });
             }
             else {
               logger.error("Error attempting to query message counter from DB for conversationID: " + conversationID);
               callback(true, null);
             }
          });
        }
      }
      else {
        logger.error("Error attempting to get the message counter for conversationID: " + conversationID + " from redis");
        callback(true, null);
      }
    });

  }
  catch(e) {
    logger.error("Exception attempting to increment message counter for conversationID: " + conversationID + ". " + e);
    callback(true, null);
  }

}
