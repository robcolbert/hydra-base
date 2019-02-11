// gab-dissent.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

(( ) => {
var hydra = window.hydra = window.hydra || { };

class GabDissent {

  constructor ( ) {

  }

  toggleReplies (event, commentId) {
    event.preventDefault();

    var replies = document.querySelector(`div[data-comment-id="${commentId}"].comment-replies`);
    if (!replies.classList.contains('d-none')) {
      replies.classList.add('d-none');
      return false;
    }
    replies.classList.remove('d-none');

    var content = replies.querySelector('.comment-replies-content');

    var resource = new hydra.HydraResource('replies', { type: 'html' });
    resource
    .fetch(`/comment/${commentId}/replies`)
    .then((response) => {
      content.innerHTML = response.response;
    })
    .catch((error) => {
      console.error('failed to load replies', error);
    });
    return false;
  }

  recordVote (event, commentId, voteType) {
    var comment = document.querySelector(`div[data-comment-id="${commentId}"].comment`);
    var upvotes = comment.querySelector('.stat-upvotes');
    var downvotes = comment.querySelector('.stat-downvotes');
    var replies = comment.querySelector('.stat-replies');

    var resource = new hydra.HydraResource();
    resource
    .post(`/comment/${commentId}/vote`, { vote: voteType })
    .then((response) => {
      console.log('comment vote', response);
      upvotes.innerHTML = numeral(response.response.stats.upvoteCount).format('0,0a');
      downvotes.innerHTML = numeral(response.response.stats.downvoteCount).format('0,0a');
      replies.innerHTML = numeral(response.response.stats.replyCount).format('0,0a');
    })
    .catch((error) => {
      console.error('comment vote error', error);
    });
  }
}

hydra.GabDissent = GabDissent;

})();