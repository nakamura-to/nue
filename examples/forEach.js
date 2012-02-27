var flow = require('../index').flow;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(files) {
    this.forEach(2)(files, function (file) {
      fs.readFile(file, 'utf8', this.async());
    });
  },
  function concat(files) {
    var data = this.args.join('');
    this.next(data);
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow(['file1', 'file2', 'file1', 'file2']);