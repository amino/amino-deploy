var fs = require('fs')
  , path = require('path')
  , exec = require('child_process').exec

module.exports = function (dir, cb) {
  fs.exists(path.join(dir, '.git'), function (exists) {
    if (!exists) return cb();
    exec('git log -n1 --pretty=oneline', {cwd: dir}, function (err, stdout, stderr) {
      if (err) return cb(err);
      cb(null, stdout.split(/\s+/)[0]);
    });
  });
};