var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var fs = require('fs');

start(serial(
  function(){
    this.data = [];
    fs.readFile('LICENSE', this.next);
  },
  function(err, data){
    if (err) throw err;
    this.data.push(data.length);
    fs.readFile('README.md', this.next);
  },
  function(err, data){
    if (err) throw err;
    this.data.push(data.length);
    console.log(this.data);
  }
));