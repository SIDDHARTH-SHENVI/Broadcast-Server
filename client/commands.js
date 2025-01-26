const parse = (input) => {
    const args = input.trim().split(' ');
    const command = args[0].toLowerCase();
  
    switch (command) {
      case '/register':
        return {
          type: 'register',
          username: args[1],
          password: args[2],
        };
      case '/login':
        return {
          type: 'login',
          username: args[1],
          password: args[2],
        };
        case '/private':
            return {
              type: 'private_message',
              to: args[1],
              text: args.slice(2).join(' '),
        };
          
      case '/join':
        return {
          type: 'join_room',
          room: args[1],
        };
      case '/room':
        return {
          type: 'room_message',
          room: args[1],
          text: args.slice(2).join(' '),
        };
      case '/help':
        return {
          
          message: 'Available commands: /register, /login, /private, /join, /room, /help',
        };
      default:
        return {
          type: 'error',
          message: 'Unknown command. Type /help for a list of commands.',
        };
    }
  };
  
  module.exports = { parse };
  