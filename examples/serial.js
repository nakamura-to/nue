var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var fs = require('fs');

start(serial(
  function(){
    fs.readFile('LICENSE', this.next);
  },
  function(err, data){
    if (err) throw err;
    console.log(data.length);
    fs.readFile('README.md', this.next);
  },
  function(err, data){
    if (err) throw err;
    console.log(data.length);
  }
));