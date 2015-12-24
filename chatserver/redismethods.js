
module.exports = {

  setKeepalive: function(clientID, clientType, clientStatus, callback) {
    /* 
     * Function to track keepalive of clients
     * Add a keepalive to redis, clientType will be: 
     *    - browser - redis key is "kabr:<clientid>" 
     *    - mobile  - redis key is "kamo:<clientid>"
     * This record will expire after a certain amount of time so we need to get a constant keepalive value coming in
     *
     * Redis key to track status of client, this is global for the client no matter what device they are on
     *      - clstat
     *            Valid values are   'online', 'busy', 'offline'
     * Client needs to change this status themselves explicitly
     * This value is persistent in redis and won't time out
     */

    var clientKey = null;

    if(clientType == "browser") {
      clientKey = "kabr:" + clientID;
    }
    else if(clientType == "mobile") {
      clientKey = "kamo:" + clientID;
    }
    else {
      logger.error("Error, unrecognized client type: " + clientType + " processing keepalive for clientID: " + clientID);
      callback(true, "Unrecognized client type");
    }

    var clientStatusKey = "clstat:" + clientID;
    _redisclient.get(clientStatusKey, function(err, clientStatusPersist) {
      if(!err) {
        logger.info("Client status is: " + clientStatusPersist);
        if(clientStatusPersist == null) {
          // we need to set the persistent status
        }
        else {

        }
      }
    });

    _redisclient.get(clientKey, function(err, reply) {
      if(!err) {
        logger.info("ClientID: " + clientID + " redis keepalive: " + reply);
        var redisValue = clientStatus;
        // set the keepalive key in redis
        //_redisclient.set(clientKey, redisValue, _redis.print);
        _redisclient.set(clientKey, redisValue, function(err, reply) {
          if(!err) {
            logger.info("Reply from redis: " + reply);
          }
          else {
            logger.error("Error trying to get keepalive from redis");
          }
        });
        // now set the key to expire
        _redisclient.expire(clientKey, _maxkeepalivetime, _redis.print);
      }
      else {
        logger.error("Error attempting to retrieve key from redis for clientID: " + clientID);
        callback(true, null);
      }
    });

  }

}

