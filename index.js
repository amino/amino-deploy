var npm = require('npm')
  , sha1 = require('./lib/sha1')
  , readJson = require('read-package-json')
  , path = require('path')
  , commithash = require('./lib/commit-hash')
  , request = require('request')
  , amino = require('amino')
  , fs = require('fs')

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

// manually parse json because formidable doesn't support json content type :(

function safeParse (body) {
  if (body) {
    try {
      body = JSON.parse(body);
    }
    catch (e) {}
  }
  return body || {};
}

program
  .command('spawn -- [cmd] [args...]')
  .description('deploy a project to drones and spawn a command')
  .option('-r, --root <dir>', 'project root which will be packed and sent to drones as the cwd. (default: cwd)', process.cwd())
  .option('--drones <count>', 'number of drones to spawn on. (default: all drones)')
  .option('--threads <count>', 'number of threads to spawn per drone. (default: drone\'s cpu count)')
  .option('-s, --service <name[@version]>', 'drone service to request, with optional semver (default: app-drone)', 'app-drone')
  .option('-r, --redis <port/host/host:port/list>', 'redis server(s) used by the service (can be comma-separated)', list)
  .action(function () {
    var program = [].slice.call(arguments).pop();
    amino.init({redis: program.redis});

    var spec = new amino.Spec(program.service);

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
              console.log('deploying project at ' + program.root);
              console.log('sha1 sum: ' + sha1sum);
              if (commit) {
                console.log('git hash: ' + commit);
              }
              var drones = [];
              // search for drones
              console.log('searching for drones...');
              amino.subscribe('_get:' + spec.service + ':' + amino.id, function (spec) {
                drones.push(spec);
              });
              amino.publish('_get:' + spec.service, amino.id);
              // end the search after one second
              var droneCount = 0
                , completed = 0
              setTimeout(function () {
                console.log('found ' + drones.length + ' drone' + (drones.length !== 1 ? 's' : '') + '.');
                if (program.drones) {
                  drones = drones.slice(0, program.drones);
                }
                droneCount = drones.length;
                if (!droneCount) {
                  ifErr(new Error('no drones to deploy to!'));
                }
                drones.forEach(deploy);
              }, 1000);
              function deploy (spec) {
                var spec = drones.shift();
                if (!spec) {
                  return;
                }
                var baseUrl = 'http://' + spec.host + ':' + spec.port;
                function spawn () {
                  var url = baseUrl + '/spawn';
                  var req = request.post({url: url, json: true}, function (err, res, body) {
                    ifErr(err);
                    body = safeParse(body);
                    if (res.statusCode === 200 && body.status === 'ok') {
                      console.log('spawned pid #' + body.pid + ' on drone ' + spec.id);
                      completed++;
                      if (completed === droneCount) {
                        console.log('spawned on ' + completed + ' drone' + (droneCount !== 1 ? 's' : '') + '!');
                        process.exit();
                      }
                    }
                    else if (res.status === 'error') {
                      ifErr(new Error('received error on spawn to ' + spec + ': ' + body.error));
                    }
                    else {
                      ifErr(new Error('received bad response for deployment to ' + spec + ': ' + res.statusCode));
                    }
                  });
                  var form = req.form();
                  form.append('cmd', spawnArgs.shift());
                  form.append('args', JSON.stringify(spawnArgs));
                }
                var url = baseUrl + '/deployments/' + sha1sum;
                var req = request(url, function (err, res, body) {
                  ifErr(err);
                  body = safeParse(body);
                  if (res.statusCode === 404) {
                    console.log('sending new deployment to drone ' + spec.id + ' at ' + url);
                    var req = request.put(url, function (err, res, body) {
                      ifErr(err);
                      body = safeParse(body);
                      console.log('drone ' + spec.id + ' replied with ' + res.statusCode);
                      if (res.statusCode === 201 || res.statusCode === 200 && body.status === 'ok') {
                        spawn();
                      }
                      else if (body.status === 'error') {
                        ifErr(new Error('received error on deploy to ' + spec + ': ' + body.error));
                      }
                      else {
                        ifErr(new Error('received bad response for deployment to ' + spec + ': ' + res.statusCode));
                      }
                    });
                    var form = req.form();
                    form.append('sha1sum', sha1sum);
                    if (commit) {
                      form.append('commit', commit);
                    }
                    form.append('payload', fs.createReadStream(file));
                  }
                  else if (res.statusCode === 200) {
                    console.log('drone ' + spec.id + ' up-to-date');
                    spawn();
                  }
                  else {
                    ifErr(new Error('unexpected status code for ' + url + ' from ' + spec + ': ' + res.statusCode));
                  }
                });
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