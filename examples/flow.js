var flow = require('../lib/nue').flow;
var fs = require('fs');

flow(
  function () {
    fs.readFile('LICENSE', this.async());
    fs.readFile('README.md', this.async());
  },
  function (data1, data2) {
    console.log(data1.length);
    console.log(data2.length);
    this.next();
  }, 
  function () {
    console.log('all done');
  }
)();
