var nue = require('../lib/nue');
var flow = nue.flow;
var each = nue.each;
var fs = require('fs');

flow(
  each(
    function () {
      this.next('LICENSE', 'README.md', 'package.json');
    },
    function (name) {
      var self = this;
      fs.readFile(name, function (err, data) {
        if (err) throw self.end(err);
        self.next(data.length);
      });
    },
    function (err, results) {
      if (err) throw err;
      console.log(results);
    }
  )
)();