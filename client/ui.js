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

const statusDot = (status) => {
  switch (status) {
    case 'online': return chalk.green('●');
    case 'away':   return chalk.yellow('●');
    case 'offline':return chalk.gray('○');
    default:       return chalk.gray('○');
  }
};

const relTime = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
};

const print = {
  banner: () => {
    console.log(chalk.cyan.bold('\n╔══════════════════════════════╗'));
    console.log(chalk.cyan.bold('║   📡  BROADCAST CHAT  📡    ║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════╝\n'));
  },
  system:  (msg) => console.log(chalk.gray(`  · ${msg}`)),
  success: (msg) => console.log(chalk.green(`  ✓ ${msg}`)),
  error:   (msg) => console.log(chalk.red(`  ✗ ${msg}`)),
  warn:    (msg) => console.log(chalk.yellow(`  ⚠ ${msg}`)),
  info:    (msg) => console.log(chalk.blue(`  ℹ ${msg}`)),
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
  userLeft:   ({ room, username }) => console.log(chalk.gray(`  · ${username} left #${room}`)),

  presenceChange: ({ username, status }) => {
    const label = status === 'online' ? 'is now online'
                : status === 'away'   ? 'went away'
                :                       'went offline';
    console.log(chalk.gray(`  · ${statusDot(status)} ${username} ${label}`));
  },

  roomsList: (rooms) => {
    if (!rooms.length) return console.log(chalk.gray('  No rooms yet.'));
    console.log(chalk.bold('\n  Rooms:'));
    rooms.forEach((r) => console.log(`    ${chalk.cyan('#' + r.name)} ${chalk.gray(`(${r.memberCount})`)}`));
    console.log();
  },
  usersList: (users) => {
    console.log(chalk.bold('\n  Users:'));
    users.forEach((u) => {
      if (typeof u === 'string') {
        console.log(`    ${chalk.green('●')} ${u}`);
      } else {
        const meta = u.status === 'offline' && u.lastActive
          ? chalk.gray(` (last seen ${relTime(u.lastActive)})`)
          : '';
        console.log(`    ${statusDot(u.status)} ${u.username}${meta}`);
      }
    });
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
      ['/users',                  'List users (with presence)'],
      ['/dm <user> <message>',    'Send private message'],
      ['/away',                   'Mark yourself as away'],
      ['/back',                   'Mark yourself as online'],
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
  // Add inside the print object:

typingStatus: (usernames) => {
  // Render below the prompt as a faint italic line, then re-show prompt
  const list = usernames.slice(0, 3).join(', ');
  const extra = usernames.length > 3 ? ` +${usernames.length - 3} more` : '';
  const verb = usernames.length === 1 ? 'is' : 'are';
  // \x1b[s save cursor, \x1b[u restore — keep it simple, just print on new line
  process.stdout.write(`\r\x1b[K${chalk.gray.italic(`  ✏  ${list}${extra} ${verb} typing...`)}\n`);
},

clearTypingLine: () => {
  // No-op: next prompt redraw will overwrite. Kept for symmetry / future use.
},

};

module.exports = { print, userColor, statusDot };
