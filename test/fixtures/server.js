var assert = require('assert')
  , http = require('http')
  , id = require('idgen')()

var server = http.createServer(function (req, res) {
  assert.equal(process.env.FOO, 'bar');
  assert.equal(process.env.BAZ, 'quo');
  assert.equal(process.env.NODE_ENV, 'production');
  assert.equal(process.argv[2], '--whut');
  res.end('ok: ' + id);
});
server.listen(0, function () {
  process.stderr.write(String(server.address().port));
});