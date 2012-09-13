// adapted from https://github.com/isaacs/npm/blob/master/lib/utils/sha.js

var fs = require("fs")
  , crypto = require("crypto")

exports.check = check
exports.get = get

function check (file, sum, cb) {
  get(file, function (er, actual) {
    if (er) {
      return cb(er)
    }
    var expected = sum.toLowerCase().trim()
      , ok = actual === expected
    cb(ok ? null : new Error(
      "shasum check failed for "+file+"\n"
      +"Expected: "+expected+"\n"
      +"Actual:   "+actual))
  })
}

function get (file, cb) {
  var h = crypto.createHash("sha1")
    , s = fs.createReadStream(file)
    , errState = null
  s.on("error", function (er) {
    if (errState) return
    return cb(errState = er)
  }).on("data", function (chunk) {
    if (errState) return
    h.update(chunk)
  }).on("end", function () {
    if (errState) return
    var actual = h.digest("hex").toLowerCase().trim()
    cb(null, actual)
  })
}
