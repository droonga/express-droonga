var winston = require('winston');

function ConsoleLogger() {
  var logger = new winston.Logger({
    transports: [
      new winston.transports.Console()
    ]
  });
  logger.transports.console.level = 'warn';
  return logger;
}

exports.ConsoleLogger = ConsoleLogger;
