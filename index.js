function list (str) {
  return str.split(/ *, */).map(function (val) {
    return val.match(/^\d+$/) ? parseInt(val, 10) : val;
  });
}

// since commander doesn't like unknown options or dynamic args, split off
// spawn args and store them.
if (process.argv[2] === 'spawn') {
  var idx = process.argv.indexOf('--');
  if (!~idx) {
    console.error('usage: amino-deploy spawn [options] -- <cmd> [args...]');
    process.exit(1);
  }
  var spawnArgs = process.argv.splice(idx + 1);
}

var program = require('commander')
  .version(require('./package').version)
  .option('-s, --service <name[@version]>', 'drone service to request, with optional semver (default: app)', 'app')
  .option('-r, --redis <port/host/host:port/list>', 'redis server(s) used by the service (can be comma-separated)', list)

program
  .command('spawn -- [cmd] [args...]')
  .description('deploy the cwd to drones and spawn a command')
  .option('-d, --cwd <dir>', 'directory which will be packed and sent to drones as the cwd. (default: cwd)', process.cwd())
  .option('--drones <count>', 'number of drones to spawn on. (default: all drones)')
  .option('--threads <count>', 'number of threads to spawn per drone. (default: drone\'s cpu count)')
  .action(function () {
    console.log('spawn ' + spawnArgs);
  })

program
  .command('respawn [sha1]')
  .description('respawn running processes, optionally on a particular sha1 hash')
  .action(function (sha1) {
    console.log('respawn ' + sha1);
  })

program
  .command('ps [sha1]')
  .description('show running processes, optionally on a particular sha1 hash')
  .action(function (sha1) {
    console.log('ps ' + sha1);
  })

program
  .command('stop [sha1]')
  .description('stop running processes, optionally on a particular sha1 hash')
  .action(function (sha1) {
    console.log('stop ' + sha1);
  })

program
  .command('sha1 [dir]')
  .description('show the sha1 sum of the target dir')
  .action(function (dir) {
    console.log('sha1 ' + dir);
  })

program
  .command('*')
  .action(function () {
    program.outputHelp();
  })

program.parse(process.argv);

if (!program.args.length) {
  program.outputHelp();
}