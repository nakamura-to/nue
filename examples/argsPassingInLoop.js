var flow = require('../index').flow;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(files) {
    process.nextTick(this.async(files));
    this.forEach(files, function (file, group) {
      fs.readFile(file, 'utf8', group());
    });
  },
  function concat(files, contents) {
    console.log(files.join(' and ') + ' have been read.');
    this.next(contents.join(''));
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow(['file1', 'file2']);