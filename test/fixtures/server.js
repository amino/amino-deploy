var assert = require('assert')
  , http = require('http')
  , lump = require('lump')

var server = http.createServer(function (req, res) {
  assert.equal(process.env.FOO, 'bar');
  assert.equal(process.env.BAZ, 'quo');
  assert.equal(process.argv[3], '--whut');
  res.end('ok');
});
server.listen(0, function () {
  process.stdout.write(String(server.address().port));
});