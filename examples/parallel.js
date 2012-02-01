var serial = require('../lib/nue').serial;
var parallel = require('../lib/nue').parallel;
var fs = require('fs');

fs.readFile('LICENSE', 
  parallel(
    function(err, data){
      if (err) throw err;
      console.log(data.toString());
      this.fork();
    },[
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
      }
    ],
    serial(
      function(err, result){
        console.log('end');
      }
    )
  )
);