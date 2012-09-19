describe('basic test', function () {
  var drones = [];
  before(function (done) {
    var started = 0;
    for (var i = 0; i < 3; i++) {
      (function () {
        var dir = '/tmp/amino-deploy-test-' + idgen();
        fs.mkdirSync(dir);
        var drone = child_process.spawn(path.resolve(__dirname, '../node_modules/.bin/amino-drone'), [dir, '--service', 'deploy-test']);
        drone.cwd = dir;
        drone.stdout.on('data', function startListener (chunk) {
          var data = chunk.toString();
          if (data.match(/started/)) {
            drone.stdout.removeListener('data', startListener);
            if (++started === 3) {
              done();
            }
          }
        });
        drone.stderr.on('data', function portListener (chunk) {
          var data = chunk.toString();
          var match = data.match(/proc#([a-zA-Z0-9]+): ([0-9]+)/);
          if (match) {
            drone.id = match[1];
            drone.port = parseInt(match[2]);
          }
        });
        process.on('exit', function () {
          drone.kill();
          rimraf(drone.cwd, function (err) {});
        });
        drones.push(drone);
      })();
    }
  });

  it('empty ps', function (done) {
    child_process.exec(path.resolve(__dirname, '../node_modules/.bin/amino') + ' --service deploy-test ps', function (err, stdout, stderr) {
      assert.ifError(err);
      assert(stdout.match(/deploy\-test/));
      assert.equal(stdout.match(/drone#[a-zA-Z0-9]{8}/g).length, drones.length);
      assert.equal(stdout.match(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]{2,5}/g).length, drones.length);
      done();
    });
  });

  it('spawn', function (done) {
    var root = path.resolve(__dirname, 'fixtures');
    var cmd = 'spawn --service deploy-test --threads 1 --drones 2 --root ' + root + ' --env.BAZ quo --env.NODE_ENV=production -- FOO=bar node server.js --whut';
    var proc = child_process.exec(path.resolve(__dirname, '../node_modules/.bin/amino') + ' ' + cmd, function (err, stdout, stderr) {
      assert.ifError(err);
      assert(stdout.match('found ' + drones.length + ' drones'));
      assert(stdout.match(/spawned ok/g).length, 2);
      assert(stdout.match('spawned on 2 drones'));
      done();
    });
  });

  it('ps', function (done) {
    child_process.exec(path.resolve(__dirname, '../node_modules/.bin/amino') + ' --service deploy-test ps', function (err, stdout, stderr) {
      assert.ifError(err);
      assert(stdout.match(/deploy\-test/));
      assert.equal(stdout.match(/proc#[a-zA-Z0-9]{8}/g).length, 2);
      done();
    });
  });

  it('deployed server', function (done) {
    var running = 0;
    drones.forEach(function (drone) {
      if (drone.port) {
        request('http://localhost:' + drone.port, function (err, res, body) {
          assert.ifError(err);
          assert.equal(body, 'ok');
          if (++running === 2) {
            done();
          }
        });
      }
    });
  });
});