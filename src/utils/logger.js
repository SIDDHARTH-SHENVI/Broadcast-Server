const chalk = require('chalk');

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[process.env.LOG_LEVEL || 'info'];

const ts = () => new Date().toISOString();

const logger = {
  error: (msg, meta = {}) => {
    if (currentLevel >= levels.error)
      console.error(chalk.red(`[${ts()}] [ERROR] ${msg}`), meta);
  },
  warn: (msg, meta = {}) => {
    if (currentLevel >= levels.warn)
      console.warn(chalk.yellow(`[${ts()}] [WARN]  ${msg}`), meta);
  },
  info: (msg, meta = {}) => {
    if (currentLevel >= levels.info)
      console.log(chalk.cyan(`[${ts()}] [INFO]  ${msg}`), meta);
  },
  debug: (msg, meta = {}) => {
    if (currentLevel >= levels.debug)
      console.log(chalk.gray(`[${ts()}] [DEBUG] ${msg}`), meta);
  },
};

module.exports = logger;
