var options = require('commander');

options.rpcHostName       = '127.0.0.1';
options.droongaEnginePort = 10031;
options.tag               = 'droonga';

function intOption(newValue, oldValue) {
  return parseInt(newValue);
}

function generateOptionHandler(onHandle, converter) {
  return function(newValue, oldValue) {
    onHandle(newValue);
    if (converter)
      return converter(newValue);
    else
      return newValue;
  };
}

function add() {
  options = options.option.apply(options, arguments);
  return exports;
}
exports.add = add;

function define() {
  add('--rpc-host-name <name>',
      'Host name of the node Serf agent is running on (' + options.rpcHostName + ')');
  add('--droonga-engine-port <port>',
      'Port number of Droonga engine (' + options.droongaEnginePort + ')',
      intOption);
  add('--tag <tag>',
      'The tag (' + options.tag + ')');
  return exports;
}
exports.define = define;

function parse(argv) {
  return options.parse(argv);
}
exports.parse = parse;
