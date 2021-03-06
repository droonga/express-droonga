var util = require('util');
var crypto = require('crypto');

function Command(options) {
  this._options = options || {};
}
Command.commandTypes = [];
Command.extend = function(targetClass) {
  if (targetClass.commandTypes)
    return;
  targetClass.commandTypes = [this];
  targetClass.prototype.isInstanceOf = function(commandType) {
    return (
      commandType &&
      this._commandTypes.indexOf(commandType) > -1
    );
  };
  Object.defineProperty(targetClass.prototype, 'dataset', {
    get: function() { return this._options.dataset; }
  });
  Object.defineProperty(targetClass.prototype, 'name', {
    get: function() {
      if (typeof this._name !== 'undefined')
        return this._name;
      return this._options.name || this._name;
    },
    set: function(name) { return this._name = name; }
  });
  Object.defineProperty(targetClass.prototype, 'authorize', {
    get: function() { return this._options.authorize; }
  });
  targetClass.isInstance = function(modelInstance) {
    return (
      modelInstance &&
      modelInstance.constructor.commandTypes &&
      modelInstance.constructor.commandTypes.indexOf(this) > -1
    );
  };
};
Command.extend(Command);



function RequestResponse(options) {
  Command.apply(this, arguments);
}
RequestResponse.extend = function(targetClass) {
  Command.extend(targetClass);
  if (targetClass.commandTypes.indexOf(this) > -1)
    return;
  targetClass.commandTypes.push(this);
  Object.defineProperty(targetClass.prototype, 'onRequest', {
    get: function() { return this._options.onRequest; }
  });
  Object.defineProperty(targetClass.prototype, 'onResponse', {
    get: function() { return this._options.onResponse; }
  });
};
RequestResponse.extend(RequestResponse);
exports.RequestResponse = RequestResponse;


function PublishSubscribe(options) {
  Command.apply(this, arguments);
  if (typeof options.messageType != 'string')
    throw new Error('You must specify "messageType" for a publish-subscribe command!');
}
PublishSubscribe.extend = function(targetClass) {
  Command.extend(targetClass);
  if (targetClass.commandTypes.indexOf(this) > -1)
    return;
  targetClass.commandTypes.push(this);
  Object.defineProperty(targetClass.prototype, 'onSubscribe', {
    get: function() { return this._options.onSubscribe; }
  });
  Object.defineProperty(targetClass.prototype, 'onSubscribed', {
    get: function() { return this._options.onSubscribed; }
  });
  Object.defineProperty(targetClass.prototype, 'onUnsubscribe', {
    get: function() { return this._options.onUnsubscribe; }
  });
  Object.defineProperty(targetClass.prototype, 'onUnsubscribed', {
    get: function() { return this._options.onUnsubscribed; }
  });
  Object.defineProperty(targetClass.prototype, 'messageType', {
    get: function() { return this._options.messageType; }
  });

  Object.defineProperty(targetClass.prototype, 'onPublish', {
    get: function() { return this._options.onPublish || this._onPublish; }
  });
  if (!targetClass.prototype._onPublish)
    targetClass.prototype._onPublish = function(publishedMessageBody, subscriberSocket) {
      subscriberSocket.emit(this.messageType, publishedMessageBody);
    };
};
PublishSubscribe.extend(PublishSubscribe);
exports.PublishSubscribe = PublishSubscribe;



function HTTPCommand(options) {
  Command.apply(this, arguments);
  if (typeof options.path != 'string')
    throw new Error('You must specify "path" for an HTTP command!');
}
HTTPCommand.extend = function(targetClass) {
  Command.extend(targetClass);
  if (targetClass.commandTypes.indexOf(this) > -1)
    return;
  targetClass.commandTypes.push(this);
  Object.defineProperty(targetClass.prototype, 'path', {
    get: function() { return this._options.path; }
  });
  Object.defineProperty(targetClass.prototype, 'method', {
    get: function() { return this._options.method || 'GET'; }
  });

  Object.defineProperty(targetClass.prototype, 'onHandle', {
    get: function() {
      var handler = this._options.onHandle || this._onHandle;
      if (!handler)
        throw new Error('onHandle() is missing');
      return handler;
    }
  });
};
HTTPCommand.extend(HTTPCommand);
exports.HTTPCommand = HTTPCommand;



function HTTPRequestResponse(options) {
  Command.apply(this, arguments);
}
HTTPRequestResponse.extend = function(targetClass) {
  HTTPCommand.extend(targetClass);
  RequestResponse.extend(targetClass);
  if (targetClass.commandTypes.indexOf(this) > -1)
    return;
  targetClass.commandTypes.push(this);
};
HTTPRequestResponse.extend(HTTPRequestResponse);
exports.HTTPRequestResponse = HTTPRequestResponse;


function HTTPStreamingSubscription() {
  this.subscribers = {};
  this.nSubscribers = 0;
  this.listener = null;
}

HTTPStreamingSubscription.prototype.addSubscriber = function (id, subscriber) {
  this.subscribers[id] = subscriber;
  this.nSubscribers += 1;
}

HTTPStreamingSubscription.prototype.removeSubscriber = function (id) {
  delete this.subscribers[id];
  this.nSubscribers -= 1;
}

function HTTPStreaming(options) {
  Command.apply(this, arguments);
  if (typeof options.subscription != 'string')
    throw new Error('You must specify "subscription" for an HTTP streaming command!');
  if (typeof options.unsubscription != 'string')
    throw new Error('You must specify "unsubscription" for an HTTP streaming command!');
  if (typeof options.messageType != 'string')
    throw new Error('You must specify "messageType" for an HTTP streaming command!');
  if (typeof options.createSubscription != 'function')
    throw new Error('You must specify "createSubscription" for an HTTP streaming command!');
}
HTTPStreaming.extend = function(targetClass) {
  HTTPCommand.extend(targetClass);
  if (targetClass.commandTypes.indexOf(this) > -1)
    return;
  targetClass.commandTypes.push(this);

  Object.defineProperty(targetClass.prototype, 'subscription', {
    get: function() { return this._options.subscription; }
  });
  Object.defineProperty(targetClass.prototype, 'unsubscription', {
    get: function() { return this._options.unsubscription; }
  });
  Object.defineProperty(targetClass.prototype, 'messageType', {
    get: function() { return this._options.messageType; }
  });

  Object.defineProperty(targetClass.prototype, 'delimiter', {
    get: function() { return this._options.delimiter || targetClass.defaultDelimiter; }
  });
  if (!targetClass.defaultDelimiter)
    targetClass.defaultDelimiter = '\n';

  Object.defineProperty(targetClass.prototype, 'lifetime', {
    get: function() { return this._options.lifetime || targetClass.defaultLifetime; }
  });
  if (!targetClass.defaultLifetime)
    targetClass.defaultLifetime = 10 * 60 * 1000; // 10 min

  Object.defineProperty(targetClass.prototype, 'createSubscription', {
    get: function() { return this._options.createSubscription; }
  });

  Object.defineProperty(targetClass.prototype, 'translate', {
    get: function() { return this._options.translate || this._translate; }
  });
  if (!targetClass.prototype._translate)
    targetClass.prototype._translate = function(publishedMessageBody) {
      return publishedMessageBody;
    };

  var subscriptions = {};
  targetClass.prototype._onPublish = function(message) {
    var subscriberIds = message.to;
    if (!Array.isArray(subscriberIds))
      subscriberIds = [subscriberIds];
    if (subscriberIds.length == 0) {
      return;
    }

    var deliveredMessage = this.translate(message.body);
    var responseText = JSON.stringify(deliveredMessage) + this.delimiter
    var subscription = subscriptions[this.messageType];
    for (var i = 0; i < subscriberIds.length; i++) {
      var subscriberId = subscriberIds[i];
      var subscriber = subscription.subscribers[subscriberId];
      if (!subscriber) {
        continue;
      }
      var response = subscriber.response;
      response.write(responseText);
    }
  };

  var connectionsCount = 0;
  targetClass.prototype._onHandle = function(request, response, connection) {
    connectionsCount++;
    var self = this;

    response.writeHead(200, {
      'Content-Type':      'application/jsons',
      'Transfer-Encoding': 'chunked'
    });

    var subscriptionMessage = this.createSubscription(request);
    if (!subscriptionMessage.route) {
      var route = connection.routeToSelf;
      subscriptionMessage.route = route;
    }
    if (!subscriptionMessage.subscriber) {
      var subscriberID = sha1sum(route + '#type=' + this.messageType + '&id=' + connectionsCount);
      subscriptionMessage.subscriber = subscriberID;
    }

    if (!subscriptions[this.messageType]) {
      var onPublish = function(message) {
	self._onPublish(message);
      };
      connection.on(this.messageType, onPublish);
      var subscription = new HTTPStreamingSubscription();
      subscription.listener = onPublish;
      subscriptions[this.messageType] = subscription;
    }
    var subscription = subscriptions[this.messageType];
    subscription.addSubscriber(subscriptionMessage.subscriber,
                               {
                                 request: request,
                                 response: response,
                                 connection: connection
                               });

    var subscribe = function() {
      connection.emit(self.subscription, subscriptionMessage);
    };

    var live = true;
    var onDisconnected = function() {
      if (!live)
        return;
      live = false;
      connection.emit(self.unsubscription, subscriptionMessage);
      request.removeListener('close', onDisconnected);
      response.removeListener('close', onDisconnected);
      var subscription = subscriptions[self.messageType];
      subscription.removeSubscriber(subscriptionMessage.subscriberId);
      if (subscription.nSubscribers == 0) {
        connection.removeListener(self.messageType, subscription.listener);
        delete subscriptions[self.messageType];
      }
    };
    request.on('close', onDisconnected);
    response.on('close', onDisconnected);

    subscribe();
    var reSubscribeTimer = setInterval(function() {
      if (live)
        subscribe();
      else
        clearInterval(reSubscribeTimer);
    }, this.lifetime * 0.5);
  };
};
HTTPStreaming.extend(HTTPStreaming);
exports.HTTPStreaming = HTTPStreaming;



function SocketCommand() {
  Command.apply(this, arguments);
}
SocketCommand.extend = function(targetClass) {
  Command.extend(targetClass);
  if (targetClass.commandTypes.indexOf(this) > -1)
    return;
  targetClass.commandTypes.push(this);
};
SocketCommand.extend(SocketCommand);
exports.SocketCommand = SocketCommand;


function SocketRequestResponse(options) {
  Command.apply(this, arguments);
}
SocketRequestResponse.extend = function(targetClass) {
  SocketCommand.extend(targetClass);
  RequestResponse.extend(targetClass);
  if (targetClass.commandTypes.indexOf(this) > -1)
    return;
  targetClass.commandTypes.push(this);
};
SocketRequestResponse.extend(SocketRequestResponse);
exports.SocketRequestResponse = SocketRequestResponse;


function SocketPublishSubscribe(options) {
  Command.apply(this, arguments);
}
SocketPublishSubscribe.extend = function(targetClass) {
  SocketCommand.extend(targetClass);
  PublishSubscribe.extend(targetClass);
  if (targetClass.commandTypes.indexOf(this) > -1)
    return;
  targetClass.commandTypes.push(this);
};
SocketPublishSubscribe.extend(SocketPublishSubscribe);
exports.SocketPublishSubscribe = SocketPublishSubscribe;


function sha1sum(source) {
  var hash = crypto.createHash('sha1');
  hash = hash.update(source);
  return hash.digest('hex');
}
exports.sha1sum = sha1sum;


function NotAuthorized(message, detail) {
  var error = new Error(message);
  error.code = 401;
  error.constructor = NotAuthorized;
  if (detail)
    error.detail = detail;
  return error;
}
exports.NotAuthorized = NotAuthorized;

function NotAllowed(message, detail) {
  var error = new Error(message);
  error.code = 403;
  error.constructor = NotAllowed;
  if (detail)
    error.detail = detail;
  return error;
}
exports.NotAllowed = NotAllowed;
