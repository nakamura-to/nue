var flow = require('../index').flow;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(files) {
    process.nextTick(this.async(files));
    files.forEach(function (file) {
      fs.readFile(file, 'utf8', this.async());
    }.bind(this));
  },
  function concat(files) {
    var data = this.args.slice(1).join('');
    console.log(files.join(' and ') + ' have been read.');
    this.next(data);
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow(['file1', 'file2']);