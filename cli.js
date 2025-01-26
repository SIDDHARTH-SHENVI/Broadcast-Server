const { spawn } = require('child_process');
const { Command } = require('commander');
const program = new Command();

program
  .command('start')
  .description('Start the broadcast server')
  .action(() => {
    console.log('Starting the broadcast server...');
    const serverProcess = spawn('node', ['server.js'], { stdio: 'inherit' });
    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
    });
  });

program
  .command('connect')
  .description('Connect a client to the broadcast server')
  .action(() => {
    console.log('Connecting to the broadcast server...');
    const clientProcess = spawn('node', ['client.js'], { stdio: 'inherit' });
    clientProcess.on('close', (code) => {
      console.log(`Client process exited with code ${code}`);
    });
  });

program.parse(process.argv);
