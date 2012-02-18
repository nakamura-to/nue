var flow = require('../lib/nue').flow;
var fs = require('fs');

flow(
  function () {
    var self = this;
    var files = ['LICENSE', 'README.md'];
    files.forEach(function (name) {
      fs.readFile(name, self.async());
    });
  },
  function () {
    var args = Array.prototype.slice.call(arguments);
    args.forEach(function (buf) {
      console.log(buf.length);
    });
    this.next();
  },
  function () {
    console.log('all done');
    this.next();
  }
)();
