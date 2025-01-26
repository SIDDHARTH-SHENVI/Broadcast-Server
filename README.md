Broadcast Server with CLI


Overview

The Broadcast Server is a CLI-based application that facilitates real-time communication among clients using WebSockets. It supports features such as user authentication, private messaging, and room-based chat. Designed to work entirely from the terminal, it is ideal for those who prefer a lightweight and straightforward messaging solution.

Features

User Authentication: Secure user registration and login with token-based authentication.

Private Messaging: Send direct messages to specific users.

Room-based Communication: Create or join chat rooms and broadcast messages to members within the room.

Real-time Messaging: Real-time updates using WebSockets.

Command-line Interface: Fully functional CLI-based interactions.

Extensible Design: Easily extendable for new features like message history or server-side persistence.


Clone this repository:
git clone <repository-url>
cd broadcast-server

Install dependencies:
npm install

Start the server:
node src/server.js


Usage
1. Starting the Server
Run the following command to start the server:
node src/server.js

The server listens on ws://localhost:3000 by default. You can modify the port in the server.js file if needed.

3. Connecting as a Client
To connect as a client, run:
node client/client.js

3. Available Commands
User Commands:

     Register a new user:
     /register <username> <password>

     Login as an existing user:
     /login <username> <password>

     Private Messaging:
     Send a private message:
     /private <target_username> <message>

     Room Management:
     Join a room:
     /join <room_name>

     Send a message to a room:
     /room <room_name> <message>

     Help:
     /help


