var serial = require('../lib/nue').serial;
var fs = require('fs');

fs.readFile('LICENSE', 
  serial(
    function(err, data){
      if (err) throw err;
      console.log(data.toString());
      fs.readFile('package.json', this.next);
    },
    function(err, data){
      if (err) throw err;
      console.log(data.toString());
      this.next();
    },
    function(){
      console.log('end 1');
    }
  )
);