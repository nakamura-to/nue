var nue = require('../lib/nue');
var fs = require('fs');

fs.readFile('LICENSE', 
  nue.series(
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
      this.next('next');
    }, 
    nue.series(
      function(data){
        console.log(data);
      }
    )
  )
);