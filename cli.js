#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const { Command } = require('commander');

const program = new Command();
program.name('broadcast').description('Broadcast Server CLI').version('1.0.0');

program
  .command('start')
  .description('Start the broadcast server')
  .action(() => {
    const proc = spawn('node', [path.join(__dirname, 'src/server.js')], { stdio: 'inherit' });
    proc.on('close', (code) => process.exit(code));
  });

program
  .command('connect')
  .description('Connect a client to the broadcast server')
  .option('-p, --profile <name>', 'Profile name for saved session', 'default')
  .action((opts) => {
    const proc = spawn(
      'node',
      [path.join(__dirname, 'client/client.js'), `--profile=${opts.profile}`],
      { stdio: 'inherit' }
    );
    proc.on('close', (code) => process.exit(code));
  });

program.parse(process.argv);
