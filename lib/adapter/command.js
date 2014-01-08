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
    get: function() { return this._options.onPublish; }
  });
};
PublishSubscribe.extend(PublishSubscribe);
exports.PublishSubscribe = PublishSubscribe;



function HTTPCommand(options) {
  Command.apply(this, arguments);
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



function HTTPStreaming(options) {
  Command.apply(this, arguments);
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

  var connectionsCount = 0;
  targetClass.prototype.onHandle = function(request, response, connection) {
    connectionsCount++;
    var self = this;

    response.writeHead(200, {
      'Content-Type':      'application/jsons',
      'Transfer-Encoding': 'chunked'
    });

    var onPublish = function(message) {
      response.write(JSON.stringify(message.body) + self.delimiter);
    };
    connection.on(this.messageType, onPublish);

    var subscriptionMessage = this.createSubscription(request);
    if (!subscriptionMessage.route) {
      var route = connection.routeToSelf;
      subscriptionMessage.route = route;
    }
    if (!subscriptionMessage.subscriber) {
      var subscriberID = sha1sum(route + '#type=' + this.messageType + '&id=' + connectionsCount);
      subscriptionMessage.subscriber = subscriberID;
    }

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
      connection.removeListener(self.messageType, onPublish);
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
