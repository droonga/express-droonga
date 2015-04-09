var winston = require('winston');

function ConsoleLogger() {
  var logger = new winston.Logger({
    transports: [
      new winston.transports.Console()
    ]
  });
  logger.transports.console.level = 'warn';
  // simulate Ruby compatible log level
  logger.trace = logger.silly;
  return logger;
}

exports.ConsoleLogger = ConsoleLogger;
