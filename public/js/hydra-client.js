// hydra-client.js
// Copyright (C) 2019 Gab AI, Inc.
// License: MIT

var hydra = window.hydra = window.hydra || { };

(function ( ) {
'use strict';

class HydraClient {

  constructor ( ) {
    var self = this;

    self.currentChatRoom = null;
    self.lastChatContent = null;
    self.socket = io('/', {
      transports: ['websocket']
    });

    self.notifications = [ ];
    self.notificationIdx = 0;
    self.isAuthenticated = false;

    self.socket.on('authenticated', self.onSocketAuthenticated.bind(self));
    self.socket.on('autherror', self.onSocketAuthError.bind(self));
    self.socket.on('notification', self.onNotification.bind(self));
    self.socket.on('chat', self.onChatMessage.bind(self));

    self.notificationAlert = document.getElementById('notification-alert');
    self.notificationTime = document.getElementById('notification-time');
    self.notificationCategory = document.getElementById('notification-category');
    self.notificationContent = document.getElementById('notification-content');

    setInterval(self.update.bind(self), 1000);
  }

  connect ( ) {
    var self = this;
    var resource = new hydra.HydraResource();
    resource
    .fetch('/user/connect-io')
    .then((connectToken) => {
      console.log('got connect token', connectToken);
      self.socket.emit('authenticate', connectToken.response);
    })
    .catch((error) => {
      console.log('client error', error);
    });
  }

  onSocketAuthenticated (message) {
    var self = this;
    console.log('onSocketAuthenticated', message);
    self.joinChannel(message.user._id);
    self.isAuthenticated = true;
    document.dispatchEvent(new Event('socketConnected'));
  }

  onSocketAuthError (message) {
    console.log('socket authentication error', message);
  }

  joinChannel (channelId) {
    var self = this;
    console.log('joining channel', channelId);
    self.socket.emit('join', { channelId: channelId });
  }

  leaveChannel (channelId) {
    var self = this;
    self.socket.emit('leave', { channelId: channelId });
  }

  setCurrentChatRoom (channelId) {
    var self = this;
    self.currentChatRoom = channelId;
  }

  onNotification (message) {
    var self = this;
    console.log('notification', message);
    self.notifications.push(message);
    self.notificationIdx = self.notifications.length - 1;
    self.updateNotificationDisplay();
  }

  initChatClient ( ) {
    var e = document.getElementById('chat-messages');
    e.scrollTop = e.scrollHeight;
  }

  /* deprecated and removing very soon */
  sendChatMessage (event, channelType, channelId) {
    var self = this;
    var input = document.getElementById('chat-input');
    self.socket.emit('chat', {
      channelType: channelType,
      channelId: channelId,
      content: input.value
    });
    input.value = '';
    event.preventDefault();
    return true;
  }

  postChatMessage (event, url) {
    var self = this;
    var resource = new hydra.HydraResource();
    var input = document.getElementById('chat-input');
    var content = input.value;
    input.value = '';

    if (content === '' || content.length < 2) {
      window.alert('Chat text cannot be empty or very short.');
      return true;
    }
    if (content === self.lastChatContent) {
      window.alert('You already sent that message');
      return true;
    }
    self.lastChatContent = content;
    console.log('postChatMessage', url, content);
    resource
    .post(url, { content: content })
    .then((response) => {
      console.log('postChatMessage response', response);
    })
    .catch((error) => {
      console.log('postChatMessage error', error);
    });
    return true;
  }

  onChatMessage (message) {
    var self = this;
    console.log('onChatMessage', message);
    if (message.room._id.toString() !== self.currentChatRoom) {
      self.createNotification({
        created: message.created,
        user: message.user,
        subjectType: message.roomType,
        subject: message.room,
        category: 'chat',
        content: message.content
      });
      return;
    }

    var messages = document.getElementById('chat-messages');
    
    var messageContainer = document.createElement('div');
    messageContainer.classList.add('chat-message');
    messages.appendChild(messageContainer);

    var messageMeta = document.createElement('div');
    messageMeta.classList.add('d-flex');
    messageMeta.classList.add('chat-meta');
    messageContainer.appendChild(messageMeta);

    var metaUsername = document.createElement('div');
    metaUsername.classList.add('d-flex');
    metaUsername.classList.add('mr-auto');
    messageMeta.appendChild(metaUsername);

    var metaUserLink = document.createElement('a');
    metaUserLink.setAttribute('href', `/user/${message.user.username}`);
    metaUserLink.innerHTML = message.user.username;
    metaUsername.appendChild(metaUserLink);

    var metaTimestamp = document.createElement('div');
    metaTimestamp.classList.add('d-flex');
    metaTimestamp.innerHTML = moment(message.created).format('HH:mm:ss');
    messageMeta.appendChild(metaTimestamp);

    var messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    messageContent.innerHTML = message.content;
    messageContainer.appendChild(messageContent);

    messages.scrollTop = messages.scrollHeight;
  }

  createNotification (notification) {
    var self = this;
    self.notifications.push(notification);
    self.notificationIdx = self.notifications.length - 1;
    self.updateNotificationDisplay();
  }

  previousNotification (event) {
    var self = this;
    event.preventDefault();
    if (--self.notificationIdx < 0) {
      self.notificationIdx = self.notifications.length - 1;
    }
    self.updateNotificationDisplay();
    return true;
  }

  nextNotification (event) {
    var self = this;
    event.preventDefault();
    if (++self.notificationIdx >= self.notifications.length) {
      self.notificationIdx = 0;
    }
    self.updateNotificationDisplay();
    return true;
  }

  closeNotification (event) {
    var self = this;
    event.preventDefault();
    self.notificationAlert.classList.add('closed');
    return true;
  }

  updateNotificationDisplay ( ) {
    var self = this;
    var message = self.notifications[self.notificationIdx];
    self.notificationTime.setAttribute('timestamp', message.created);
    self.notificationTime.innerText = moment(message.created).fromNow();
    self.notificationCategory.innerText = message.category;
    self.notificationContent.innerHTML = message.content;
    self.notificationAlert.classList.remove('closed');
    console.log('display notification', self.notificationIdx);
  }

  update ( ) {
    // var self = this;
    // var time = self.notificationTime.getAttribute('timestamp');
    // self.notificationTime.innerText = moment(time).fromNow();
  }

  showModal (options) {
    var title = document.querySelector('#hydra-modal .modal-title');
    title.innerText = options.title;

    var prompt = document.querySelector('#hydra-modal #modal-prompt');
    prompt.innerText = options.prompt;

    var footer = document.querySelector('#hydra-modal .modal-footer');
    while (footer.firstChild) {
      footer.removeChild(footer.firstChild);
    }
    options.buttons.forEach((button) => {
      var buttonElement = document.createElement('button');
      buttonElement.setAttribute('type', 'button');
      if (button.onclick) {
        buttonElement.onclick = button.onclick;
      }
      if (button.label) {
        buttonElement.innerText = button.label;
      }
      buttonElement.classList.add('btn');
      if (button.class) {
        buttonElement.classList.add(button.class);
      }
      footer.appendChild(buttonElement);
    });
    $('#hydra-modal').modal({ show: true }); // jshint ignore: line
  }

  showLightbox (imageUrl) {
    var lightbox = document.querySelector('#hydra-lightbox');
    var lightboxImg = document.querySelector('#hydra-lightbox-image');
    lightbox.classList.remove('d-none');
    lightbox.classList.add('d-flex');
    lightboxImg.src = imageUrl;
  }

  hideLightbox ( ) {
    var lightbox = document.querySelector('#hydra-lightbox');
    lightbox.classList.remove('d-flex');
    lightbox.classList.add('d-none');
  }
}

hydra.HydraClient = HydraClient;

})();