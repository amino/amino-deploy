var npm = require('npm')
  , sha1 = require('./lib/sha1')
  , readJson = require('read-package-json')
  , path = require('path')
  , commithash = require('./lib/commit-hash')

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
  .usage('<command>')
  .option('-s, --service <name[@version]>', 'drone service to request, with optional semver (default: app)', 'app')
  .option('-r, --redis <port/host/host:port/list>', 'redis server(s) used by the service (can be comma-separated)', list)

function ifErr (err) {
  if (err) {
    if (err.stack) {
      console.error(err.stack);
    }
    else {
      console.error(err);
    }
    process.exit(1);
  }
}

program
  .command('spawn -- [cmd] [args...]')
  .description('deploy a project to drones and spawn a command')
  .option('-r, --root <dir>', 'project root which will be packed and sent to drones as the cwd. (default: cwd)', process.cwd())
  .option('--drones <count>', 'number of drones to spawn on. (default: all drones)')
  .option('--threads <count>', 'number of threads to spawn per drone. (default: drone\'s cpu count)')
  .action(function () {
    var program = [].slice.call(arguments).pop();
    readJson(path.join(program.root, 'package.json'), function (err, data) {
      ifErr(err);

      var name = data.name
        , version = data.version

      commithash(program.root, function (err, commit) {
        ifErr(err);
        npm.load(function (err) {
          ifErr(err);
          npm.commands.cache(['add', program.root], function (err) {
            ifErr(err);
            var file = path.join(npm.cache, name, version, 'package.tgz');
            sha1.get(file, function (err, sha1sum) {
              ifErr(err);
              console.log('deployed project at ' + program.root);
              console.log('sha1 sum: ' + sha1sum);
              if (commit) {
                console.log('git hash: ' + commit);
              }
            });
          });
        });
      });
    });
  })

program
  .command('respawn [sha1]')
  .description('respawn running processes, optionally on a particular git sha1')
  .action(function (sha1) {
    console.log('respawn ' + sha1);
  })

program
  .command('ps [sha1]')
  .description('show running processes, optionally on a particular git sha1')
  .action(function (sha1) {
    console.log('ps ' + sha1);
  })

program
  .command('stop [sha1]')
  .description('stop running processes, optionally on a particular git sha1')
  .action(function (sha1) {
    console.log('stop ' + sha1);
  })

program
  .command('*')
  .description('output help')
  .action(function () {
    program.outputHelp();
  })

program.parse(process.argv);

if (!program.args.length) {
  program.outputHelp();
}