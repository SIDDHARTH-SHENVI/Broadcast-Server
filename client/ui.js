const chalk = require('chalk');

const colors = ['cyan', 'green', 'yellow', 'magenta', 'blue', 'red'];
const userColor = (name) => {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
};

const time = (ts) => {
  const d = ts ? new Date(ts) : new Date();
  return d.toTimeString().slice(0, 5);
};

const print = {
  banner: () => {
    console.log(chalk.cyan.bold('\n╔══════════════════════════════╗'));
    console.log(chalk.cyan.bold('║   📡  BROADCAST CHAT  📡    ║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════╝\n'));
  },
  system: (msg) => console.log(chalk.gray(`  · ${msg}`)),
  success: (msg) => console.log(chalk.green(`  ✓ ${msg}`)),
  error: (msg) => console.log(chalk.red(`  ✗ ${msg}`)),
  info: (msg) => console.log(chalk.blue(`  ℹ ${msg}`)),
  welcome: (msg) => console.log(chalk.cyan(`  ${msg}`)),
  roomMsg: ({ room, from, text, timestamp, isSelf }) => {
    const color = userColor(from);
    const name = isSelf ? chalk[color].bold(`${from} (you)`) : chalk[color].bold(from);
    console.log(`${chalk.gray(`[${time(timestamp)}]`)} ${chalk.gray(`#${room}`)} ${name}: ${text}`);
  },
  privateMsg: ({ from, text, timestamp }) => {
    console.log(`${chalk.gray(`[${time(timestamp)}]`)} ${chalk.magenta.bold(`📩 ${from}`)}: ${chalk.magenta(text)}`);
  },
  privateSent: ({ to, text, timestamp }) => {
    console.log(`${chalk.gray(`[${time(timestamp)}]`)} ${chalk.magenta(`→ ${to}`)}: ${text}`);
  },
  userJoined: ({ room, username }) => console.log(chalk.gray(`  · ${username} joined #${room}`)),
  userLeft: ({ room, username }) => console.log(chalk.gray(`  · ${username} left #${room}`)),
  roomsList: (rooms) => {
    if (!rooms.length) return console.log(chalk.gray('  No rooms yet.'));
    console.log(chalk.bold('\n  Rooms:'));
    rooms.forEach((r) => console.log(`    ${chalk.cyan('#' + r.name)} ${chalk.gray(`(${r.memberCount})`)}`));
    console.log();
  },
  usersList: (users) => {
    console.log(chalk.bold('\n  Online users:'));
    users.forEach((u) => console.log(`    ${chalk.green('●')} ${u}`));
    console.log();
  },
  help: () => {
    console.log(chalk.bold('\n  Commands:'));
    const cmds = [
      ['/register <user> <pass>', 'Create account & login'],
      ['/login <user> <pass>',    'Login to existing account'],
      ['/logout',                 'Logout & clear saved session'],
      ['/join <room>',            'Join a room (becomes active)'],
      ['/leave <room>',           'Leave a room'],
      ['/switch <room>',          'Switch active room'],
      ['/rooms',                  'List all rooms'],
      ['/users',                  'List online users'],
      ['/dm <user> <message>',    'Send private message'],
      ['/clear',                  'Clear screen'],
      ['/help',                   'Show this help'],
      ['/quit',                   'Exit'],
      ['<message>',               'Send to active room'],
    ];
    cmds.forEach(([c, d]) => console.log(`    ${chalk.cyan(c.padEnd(28))} ${chalk.gray(d)}`));
    console.log();
  },
  prompt: (activeRoom, username) => {
    if (!username) return chalk.gray('> ');
    if (activeRoom) return `${chalk.cyan(`#${activeRoom}`)} ${chalk.gray(username)} ${chalk.cyan('›')} `;
    return `${chalk.gray(username)} ${chalk.cyan('›')} `;
  },
};

module.exports = { print, userColor };
