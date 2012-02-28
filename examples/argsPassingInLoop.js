var flow = require('../index').flow;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(files) {
    process.nextTick(this.async(files));
    this.forEach(files, function (file) {
      fs.readFile(file, 'utf8', this.async());
    });
  },
  function concat(files) {
    console.log(files.join(' and ') + ' have been read.');
    this.next(this.args.slice(1).join(''));
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow(['file1', 'file2']);