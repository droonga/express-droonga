var HAVE_UNPROCESSED_MESSAGES_TAG_PREFIX = 'buffered-for-';

module.exports = {
  nodeType:         'type',
  nodeRole:         'role',
  internalNodeName: 'internal-name',
  clusterId:        'cluster_id',

  acceptMessagesNewerThan:       'accept-newer-than',
  lastMessageTimestamp: 'last-timestamp',

  haveUnprocessedMessagesTagFor: function(nodeName) {
    return HAVE_UNPROCESSED_MESSAGES_TAG_PREFIX + nodeName;
  },
  isHaveUnprocessedMessagesTag: function(tag) {
    return tag.indexOf(HAVE_UNPROCESSED_MESSAGES_TAG_PREFIX == 0);
  },
  extractNodeNameFromHaveUnprocessedMessagesTag: function(tag) {
    return tag.replace(HAVE_UNPROCESSED_MESSAGES_TAG_PREFIX, '');
  }
};
