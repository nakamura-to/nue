var nue = require('../lib/nue');
var fs = require('fs');

fs.readFile('LICENSE', 
  nue.parallel([
    function(err, data){
      if (err) throw err;
      console.log(data.toString());
      this.join();
    },
    function(){
      var self = this;
      setTimeout(function () {
        console.log('bbb');
        self.join();
      }, 100);
    },
    function(){
      console.log('ccc');
      this.join();
    }],
    nue.series(
      function(err){
        console.log('end');
      }
    )
  )
);