const pino = require('pino');
const path = require('path');

const fileTransport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      options: { destination: 1 } // stdout
    },
    {
      target: 'pino/file',
      options: { destination: path.join(__dirname, '../data/bot.log'), mkdir: true }
    }
  ]
});

const logger = pino(fileTransport);

module.exports = logger;
