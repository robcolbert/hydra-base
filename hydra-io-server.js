// hydra-io-server.js
// Copyright (C) 2019 Gab AI, Inc.
// License: MIT

'use strict';

(( ) => {

const path = require('path');
const mongoose = require('mongoose');

const HydraError = require(path.join(__dirname, 'app', 'hydra-error'));

class HydraIoServer {
  
  constructor (server) {
    var self = this;

    self.server = server;
    self.log = server.log;
    self.io = server.app.locals.io;
    self.root = self.io.of('/');
    self.admin = self.io.of('/admin');
    self.sockets = [ ];
    self.users = { };

    self.io.on('connection', self.onConnection.bind(self));
    self.log.info('Hydra io-server online');
  }

  onConnection (socket) {
    var self = this;
    self.sockets.push(socket);
    self.attachAuthenticationProtocol(socket);
  }

  attachAuthenticationProtocol (socket) {
    var self = this;
    socket.on('authenticate', self.onSocketAuthenticate.bind(self, socket));
  }

  onSocketAuthenticate (socket, message) {
    const ConnectToken = mongoose.model('ConnectToken');
    var self = this;
    ConnectToken
    .findOne({ token: message.token })
    .populate('user')
    .then((token) => {
      if (!token) {
        return Promise.reject(new HydraError(404, 'Authentication token not found.'));
      }
      token.claimed = true;
      return token.save();
    })
    .then((token) => {
      var user = {
        user: token.user,
        socket: socket
      };
      self.log.debug('socket authenticated', {
        userId: token.user._id,
        username: token.user.username
      });
      self.users[token.user._id] = user;
      self.attachClientProtocol(user);
      user.socket.emit('authenticated', {
        user: user.user,
        message: 'You are authorized for realtime messaging on this Hydra node.'
      });
    })
    .catch((error) => {
      self.log.error('onSocketAuthenticate error', { error: error });
      socket.emit('error', {
        code: error.statusCode || error.code || 500,
        message: error.message || 'Internal server error'
      });
    });
  }

  attachClientProtocol (user) {
    var self = this;
    user.socket.on('join', self.onJoin.bind(self, user));
    user.socket.on('leave', self.onLeave.bind(self, user));
    user.socket.on('chat', self.onChatMessage.bind(self, user));
  }

  onJoin (user, message) {
    user.socket.join(message.channelId);
  }

  onLeave (user, message) {
    user.socket.leave(message.channelId);
  }

  onChatMessage (user, message) {
    var self = this;
    const ChatMessage = mongoose.model('ChatMessage');
    ChatMessage
    .create({
      roomType: message.channelType,
      room: message.channelId,
      user: user.user,
      content: message.content
    })
    .then((message) => {
      self.root.to(message.room).emit('chat', message);
    })
    .catch((error) => {
      self.log.error('onChatMessage', error);
    });
  }

  broadcast (messageType, message) {
    this.log.info('ioserver.broadcast', { msgType: messageType, msg: message });
    this.root.emit(messageType, message);
  }
}

module.exports = HydraIoServer;

})();