var npm = require('npm')
  , sha1 = require('./lib/sha1')
  , readJson = require('read-package-json')
  , path = require('path')
  , commithash = require('./lib/commit-hash')
  , request = require('request')
  , amino = require('amino')
  , fs = require('fs')
  , archy = require('archy')
  , moment = require('moment')
  , yaml = require('yamljs')

function list (str) {
  return str.split(/ *, */).map(function (val) {
    return val.match(/^\d+$/) ? parseInt(val, 10) : val;
  });
}

// since commander doesn't like unknown options or dynamic args, split off
// spawn args and store them.
if (process.argv[2] === 'deploy') {
  var idx = process.argv.indexOf('--');
  if (~idx) {
    var spawnArgs = process.argv.splice(idx + 1);
    var spawnEnv = {};
    for (var i = 0; i < spawnArgs.length; i++) {
      var match = spawnArgs[i].match(/^([A-Z0-9_]+)=(.*?)$/);
      if (match) {
        spawnEnv[match[1]] = match[2];
        spawnArgs.shift();
      }
      else {
        break;
      }
    }
    var argv = [].concat(process.argv);
    process.argv = [];
    for (var i = 0; i < argv.length; i++) {
      var match = argv[i].match(/^\-\-env\.([A-Z0-9_]+)(?:=(.*))?$/);
      if (match && match[2]) {
        spawnEnv[match[1]] = match[2];
      }
      else if (match && match[1]) {
        spawnEnv[match[1]] = argv.splice(i + 1, 1)[0];
      }
      else {
        process.argv.push(argv[i]);
      }
    }
    var spawnCmd = spawnArgs.shift();
  }
  else {
    var spawnCmd = false;
  }
}

var program = require('commander')
  .version(require('./package').version)
  .option('-s, --service <name[@version]>', 'drone service to request, with optional semver (default: app-drone)')
  .option('-r, --redis <port/host/host:port/list>', 'redis server(s) used by the service (can be comma-separated)', list)
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

function findDrones(program, cb) {
  var drones = [];
  if (!amino.Spec) amino.init({redis: program.parent.redis});
  var spec = new amino.Spec(program.parent.service);
  console.log('searching for ' + spec.service + ' drones...');
  amino.subscribe('_get:' + spec.service + ':' + amino.id, function (spec) {
    drones.push(new amino.Spec(spec));
  });
  amino.publish('_get:' + spec.service, amino.id);
  // end the search after one second
  var completed = 0
  setTimeout(function () {
    console.log('found ' + drones.length + ' drone' + (drones.length !== 1 ? 's' : '') + '.');
    if (program.drones) {
      drones = drones.slice(0, program.drones);
    }
    cb(drones);
  }, 1000);
}

program
  .command('deploy -- [cmd] [args...]')
  .description('deploy a project to drones and optionally spawn a command')
  .option('-r, --root <dir>', 'project root which will be packed and sent to drones as the cwd. (default: cwd)', process.cwd())
  .option('--drones <count>', 'number of drones to spawn on. (default: all drones)')
  .option('--threads <count>', 'number of threads to spawn per drone. (default: drone\'s cpu count)')
  .action(function () {
    var program = [].slice.call(arguments).pop();
    applyConfig(program);

    readJson(path.join(program.root, 'package.json'), function (err, data) {
      ifErr(err);

      var name = data.name
        , version = data.version
        , completed = 0

      commithash(program.root, function (err, commit) {
        ifErr(err);
        npm.load(function (err) {
          ifErr(err);
          console.log('preparing deployment...');
          npm.commands.cache(['add', program.root], function (err) {
            ifErr(err);
            var file = path.join(npm.cache, name, version, 'package.tgz');
            sha1.get(file, function (err, sha1sum) {
              ifErr(err);
              console.log('\ndeploying project at ' + program.root);
              console.log('sha1 sum: ' + sha1sum);
              if (commit) {
                console.log('git hash: ' + commit);
              }
              console.log();
              var drones;
              findDrones(program, function (foundDrones) {
                drones = foundDrones;
                if (!drones.length) {
                  ifErr(new Error('no drones to deploy to!'));
                }
                drones.forEach(deploy);
              });
              function deploy (spec) {
                var baseUrl = 'http://' + spec.host + ':' + spec.port;
                function spawn () {
                  if (!spawnCmd) {
                    if (++completed === drones.length) {
                      process.exit();
                    }
                    return;
                  }
                  var url = baseUrl + '/deployments/' + sha1sum + '/spawn';
                  var req = request.post({url: url, json: true}, function (err, res, body) {
                    ifErr(err);
                    body = safeParse(body);
                    if (res.statusCode === 200 && body.status === 'ok') {
                      console.log('drone ' + spec.id + ': spawned ok');
                      if (++completed === drones.length) {
                        console.log('spawned on ' + completed + ' drone' + (drones.length !== 1 ? 's' : '') + '!');
                        process.exit();
                      }
                    }
                    else if (res.status === 'error') {
                      ifErr(new Error('drone ' + spec.id + ': received error on spawn: ' + body.error));
                    }
                    else {
                      ifErr(new Error('drone ' + spec.id + ': bad response code on spawn: ' + res.statusCode));
                    }
                  });
                  var form = req.form();
                  form.append('cmd', spawnCmd);
                  form.append('args', JSON.stringify(spawnArgs));
                  form.append('env', JSON.stringify(spawnEnv));
                  if (commit) {
                    form.append('commit', commit);
                  }
                  if (program.threads) {
                    form.append('threads', program.threads);
                  }
                }
                var url = baseUrl + '/deployments/' + sha1sum;
                var req = request(url, function (err, res, body) {
                  ifErr(err);
                  body = safeParse(body);
                  if (res.statusCode === 404) {
                    console.log('drone ' + spec.id + ': deploying...');
                    var req = request.put(url, function (err, res, body) {
                      ifErr(err);
                      body = safeParse(body);
                      if (res.statusCode === 201 || res.statusCode === 200 && body.status === 'ok') {
                        spawn();
                      }
                      else if (body.status === 'error') {
                        ifErr(new Error('drone ' + spec.id + ': received error on deploy: ' + body.error));
                      }
                      else {
                        ifErr(new Error('drone ' + spec.id + ': bad response code on deploy: ' + res.statusCode));
                      }
                    });
                    var form = req.form();
                    form.append('name', name);
                    form.append('sha1sum', sha1sum);
                    if (commit) {
                      form.append('commit', commit);
                    }
                    form.append('payload', fs.createReadStream(file));
                  }
                  else if (res.statusCode === 200) {
                    console.log('drone ' + spec.id + ': up-to-date');
                    spawn();
                  }
                  else {
                    ifErr(new Error('drone ' + spec.id + ': bad response code on GET ' + url + ': ' + res.statusCode));
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
  .command('respawn [sha1/id]')
  .description('respawn running processes, optionally on a particular git or tarball sha1 or process id')
  .action(function (sha1, program) {
    applyConfig(program);
    findDrones(program, function (drones) {
      if (!drones.length) ifErr(new Error('no drones found!'));
      var completed = 0;
      drones.forEach(function (spec) {
        var baseUrl = 'http://' + spec.host + ':' + spec.port;
        var path = sha1 ? '/ps/' + sha1 + '/respawn' : '/respawn';
        request.post(baseUrl + path, function (err, res, body) {
          ifErr(err);
          body = safeParse(body);
          if (res.statusCode === 200) {
            console.log('drone ' + spec.id + ': respawned ' + body.count + ' processes');
          }
          else {
            console.log('drone ' + spec.id + ': error ' + res.statusCode + ': ' + body.error);
          }
          completed++;
          if (completed === drones.length) {
            process.exit();
          }
        });
      });
    });
  })

program
  .command('ps [sha1]')
  .description('show running processes, optionally on a particular git or tarball sha1')
  .action(function (sha1, program) {
    applyConfig(program);
    findDrones(program, function (drones) {
      if (!drones.length) ifErr(new Error('no drones found!'));
      var completed = 0, ps = {label: program.parent.service, nodes: []};
      drones.forEach(function (spec) {
        var baseUrl = 'http://' + spec.host + ':' + spec.port;
        var path = sha1 ? '/ps/' + sha1 : '/ps';
        request.get(baseUrl + path, function (err, res, body) {
          ifErr(err);
          body = safeParse(body);
          if (res.statusCode === 200) {
            ps.nodes.push({
              label: 'drone#' + spec.id + ' (' + spec.host + ':' + spec.port + ')',
              nodes: Object.keys(body.ps).map(function (pid) {
                return {
                  label: 'proc#' + pid,
                  nodes: Object.keys(body.ps[pid]).filter(function (k) {
                    return !k.match(/^(env|id)$/);
                  }).map(function (k) {
                    var val = body.ps[pid][k];
                    if (k === 'uptime') {
                      val = moment.humanizeDuration(val);
                    }
                    else if (k === 'lastRespawn') {
                      val = moment.humanizeDuration(-1 * val, true);
                    }
                    return k + ': ' + val;
                  })
                };
              })
            });
          }
          else {
            console.log('drone ' + spec.id + ': error ' + res.statusCode + ': ' + body.error);
          }
          completed++;
          if (completed === drones.length) {
            console.log(archy(ps));
            process.exit();
          }
        });
      });
    });
  })

program
  .command('stop [sha1/id]')
  .description('stop running processes, optionally on a particular git or tarball sha1 or process id')
  .action(function (sha1, program) {
    applyConfig(program);
    findDrones(program, function (drones) {
      if (!drones.length) ifErr(new Error('no drones found!'));
      var completed = 0, ps = {label: program.parent.service, nodes: []};
      drones.forEach(function (spec) {
        var baseUrl = 'http://' + spec.host + ':' + spec.port;
        var path = sha1 ? '/ps/' + sha1 : '/ps';
        request.del(baseUrl + path, function (err, res, body) {
          ifErr(err);
          body = safeParse(body);
          if (res.statusCode === 200) {
            console.log('drone ' + spec.id + ': stopped ' + body.count + ' processes');
          }
          else {
            console.log('drone ' + spec.id + ': error ' + res.statusCode + ': ' + body.error);
          }
          completed++;
          if (completed === drones.length) {
            process.exit();
          }
        });
      });
    });
  })

program
  .command('config')
  .description('save arguments to .amino.yml to act as defaults')
  .action(function (program) {
    applyConfig(program);
    var opts = {
      service: program.parent.service,
      redis: program.parent.redis
    };
    fs.writeFile('.amino.yml', yaml.stringify(opts), function (err) {
      ifErr(err);
      console.log('wrote .amino.yml');
    });
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

function applyConfig (program) {
  try {
    var opts = yaml.load('.amino.yml');
    Object.keys(opts).forEach(function (k) {
      if (typeof program.parent[k] === 'undefined') {
        program.parent[k] = opts[k];
      }
    });
  }
  catch (e) {};
  program.parent.service || (program.parent.service = 'app-drone');
}