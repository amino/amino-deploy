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
          if (chunk.toString().match(/started/)) {
            drone.stdout.removeListener('data', startListener);
            if (++started === 3) {
              done();
            }
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

  it('shows empty ps', function (done) {
    child_process.exec(path.resolve(__dirname, '../node_modules/.bin/amino') + ' --service deploy-test ps', function (err, stdout, stderr) {
      assert.ifError(err);
      assert(stdout.match(/deploy\-test/));
      assert.equal(stdout.match(/drone#[a-zA-Z0-9]{8}/g).length, drones.length);
      assert.equal(stdout.match(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]{2,5}/g).length, drones.length);
      done();
    });
  });

  it('spawns', function (done) {
    var root = path.resolve(__dirname, 'fixtures');
    var cmd = 'spawn --service deploy-test --threads 1 --drones 2 --root ' + root + ' --env.BAZ=quo -- FOO=bar node server.js --whut';
    var proc = child_process.exec(path.resolve(__dirname, '../node_modules/.bin/amino') + ' ' + cmd, function (err, stdout, stderr) {
      assert.ifError(err);
      assert(stdout.match('found ' + drones.length + ' drones'));
      assert(stdout.match(/spawned ok/g).length, 2);
      assert(stdout.match('spawned on 2 drones'));
      done();
    });
  });
});