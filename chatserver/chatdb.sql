-- MySQL dump 10.13  Distrib 5.6.15, for Linux (x86_64)
--
-- Host: localhost    Database: chatdb
-- ------------------------------------------------------
-- Server version	5.6.15-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `chatparticipants`
--

DROP TABLE IF EXISTS `chatparticipants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chatparticipants` (
  `conversationparticipantID` int(32) unsigned NOT NULL AUTO_INCREMENT,
  `clientID` int(24) unsigned NOT NULL COMMENT 'id of the client who is in the chat',
  `chatsessionid` int(24) unsigned NOT NULL COMMENT 'id of the chat session',
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive' COMMENT 'is the participant active',
  `inactive_date` datetime DEFAULT NULL,
  PRIMARY KEY (`conversationparticipantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='participants in the conversation';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chatservers`
--

DROP TABLE IF EXISTS `chatservers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chatservers` (
  `chatserverID` int(4) unsigned NOT NULL AUTO_INCREMENT,
  `servername` varchar(32) NOT NULL COMMENT 'name of the server',
  `serverip` varchar(32) NOT NULL COMMENT 'ip address of the server',
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive' COMMENT 'is the chat server active',
  `inactive_date` datetime DEFAULT NULL,
  PRIMARY KEY (`chatserverID`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8 COMMENT='chatservers that accept sessions to track the session that a user is on';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chatsessions`
--

DROP TABLE IF EXISTS `chatsessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chatsessions` (
  `chatsessionid` int(24) unsigned NOT NULL AUTO_INCREMENT,
  `jsessionid` varchar(64) NOT NULL COMMENT 'JSESSIONID associated with the session',
  `clientID` int(11) unsigned NOT NULL COMMENT 'client who the session is for',
  `chatserverID` int(4) unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiretime` datetime NOT NULL COMMENT 'time that the session will expire',
  PRIMARY KEY (`chatsessionid`),
  KEY `jession_id` (`jsessionid`) USING BTREE
) ENGINE=MEMORY AUTO_INCREMENT=87 DEFAULT CHARSET=utf8 COMMENT='track JSESSIONIDs associated with a chat session';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `clientstate`
--

DROP TABLE IF EXISTS `clientstate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `clientstate` (
  `clientstateid` int(24) unsigned NOT NULL AUTO_INCREMENT,
  `clientID` int(11) unsigned NOT NULL COMMENT 'client who the record is for',
  `clientstate` enum('online','busy','offline') NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive' COMMENT 'status of the record',
  `inactive_date` datetime DEFAULT NULL,
  PRIMARY KEY (`clientstateid`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8 COMMENT='track state of a client';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `conversation`
--

DROP TABLE IF EXISTS `conversation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `conversation` (
  `conversationID` int(32) unsigned NOT NULL AUTO_INCREMENT,
  `clientIDcreator` int(24) unsigned NOT NULL COMMENT 'id of the client that created the chat',
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive' COMMENT 'is this conversation active',
  `inactive_date` datetime DEFAULT NULL,
  PRIMARY KEY (`conversationID`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8 COMMENT='record of chat conversations, these will be between two or more participants';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `conversationparticipants`
--

DROP TABLE IF EXISTS `conversationparticipants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `conversationparticipants` (
  `conversationparticipantID` int(32) unsigned NOT NULL AUTO_INCREMENT,
  `clientID` int(24) unsigned NOT NULL COMMENT 'id of the client who is in the chat',
  `conversationID` int(32) unsigned NOT NULL COMMENT 'conversation that this is a member of',
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive' COMMENT 'is the participant active',
  `inactive_date` datetime DEFAULT NULL,
  PRIMARY KEY (`conversationparticipantID`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8 COMMENT='participants in a conversation';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessionserver`
--

DROP TABLE IF EXISTS `sessionserver`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessionserver` (
  `sessionserverID` int(32) unsigned NOT NULL AUTO_INCREMENT,
  `chatserverID` int(4) unsigned NOT NULL COMMENT 'server that the session is on',
  `chatsessionID` int(24) unsigned NOT NULL COMMENT 'id of the session',
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive' COMMENT 'is this server session active',
  `inactive_date` datetime DEFAULT NULL,
  PRIMARY KEY (`sessionserverID`)
) ENGINE=MEMORY DEFAULT CHARSET=utf8 COMMENT='server that the chat session is on';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2015-12-26 14:44:45
