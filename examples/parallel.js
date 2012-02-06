var nue = require('../lib/nue');
var flow = nue.flow;
var parallel = nue.parallel;
var fs = require('fs');

flow(
  function () {
    this.next(null, 'LICENSE', 'README.md');
  },
  parallel(
    function (name) {
      var self = this;
      fs.readFile(name, function (err, data) {
        if (err) this.end(err);
        self.join(null, data.length);
      });
    },
    function (path) {
      var self = this;
      fs.stat(path, function (err, stats) {
        if (err) this.end(err);
        self.join(null, stats.isFile());
      });
    }
  ),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
  }
)();