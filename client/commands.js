// Parses user input into either a server message or a local command.
// Returns { kind: 'server'|'local'|'send_active'|'noop'|'error', ... }

const parse = (input, state) => {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'noop' };

  if (!trimmed.startsWith('/')) {
    if (!state.activeRoom) {
      return { kind: 'error', message: 'No active room. Use /join <room> first, or /dm <user> <msg>.' };
    }
    return {
      kind: 'server',
      payload: { type: 'room_message', room: state.activeRoom, text: trimmed },
    };
  }

  const [cmd, ...rest] = trimmed.split(' ');
  const args = rest;

  switch (cmd.toLowerCase()) {
    case '/register':
      if (args.length < 2) return { kind: 'error', message: 'Usage: /register <user> <pass>' };
      return { kind: 'server', payload: { type: 'register', username: args[0], password: args[1] } };

    case '/login':
      if (args.length < 2) return { kind: 'error', message: 'Usage: /login <user> <pass>' };
      return { kind: 'server', payload: { type: 'login', username: args[0], password: args[1] } };

    case '/logout':
      return { kind: 'local', action: 'logout' };

    case '/join':
      if (!args[0]) return { kind: 'error', message: 'Usage: /join <room>' };
      return {
        kind: 'server',
        payload: { type: 'join_room', room: args[0] },
        afterSend: { setActive: args[0] },
      };

    case '/leave':
      if (!args[0]) return { kind: 'error', message: 'Usage: /leave <room>' };
      return { kind: 'server', payload: { type: 'leave_room', room: args[0] } };

    case '/switch':
      if (!args[0]) return { kind: 'error', message: 'Usage: /switch <room>' };
      return { kind: 'local', action: 'switch', room: args[0] };

    case '/rooms':
      return { kind: 'server', payload: { type: 'list_rooms' } };

    case '/users':
      return { kind: 'server', payload: { type: 'list_users' } };

    case '/dm':
    case '/private':
      if (args.length < 2) return { kind: 'error', message: 'Usage: /dm <user> <message>' };
      return {
        kind: 'server',
        payload: { type: 'private_message', to: args[0], text: args.slice(1).join(' ') },
      };

    case '/clear':
      return { kind: 'local', action: 'clear' };

    case '/help':
      return { kind: 'local', action: 'help' };

    case '/quit':
    case '/exit':
      return { kind: 'local', action: 'quit' };
    // Add inside your switch/case for command parsing:

    case '/away':
      return { kind: 'server', payload: { type: 'set_status', status: 'away' } };

    case '/back':
      return { kind: 'server', payload: { type: 'set_status', status: 'online' } };


    default:
      return { kind: 'error', message: `Unknown command: ${cmd}. Type /help.` };
  }
};

module.exports = { parse };
