var nue = require('../lib/nue.js');

step1();

function step1() {
  console.log('step1 start');
  nue.parallel([
    function(){
      console.log('aaa:');
    },
    function(){
      console.log('bbb:');
    }], 
    function(err){
      if (err) throw err;
      console.log('step1 end\n');
      step2();
    }
  );
}

function step2() {
  console.log('step2 start');
  nue.series([
    function () {
      console.log('ccc:');
      this.next('test', 2);
    },
    function (a, b){
      console.log('ddd: ' + a + ', ' + b);
      this.next();
    }],
    function (err) {
      if (err) throw err;
      console.log('step2 end\n');
      step3();
    }
  );
}

function step3() {
  console.log("step3 start");
  var q = nue.parallelQueue(
    function (data){
      console.log('data: ' + data);
    },
    function (err) {
      if (err) throw err;
      console.log('step3 end\n');
      step4();
    }
  );
  for (var i = 0; i < 5; i++) {
    q.push(i);  
  }
  q.complete();
}

function step4() {
  console.log("step4 start");
  var q = nue.seriesQueue(
    function (data){
      console.log('data: ' + data);
      this.next();
    },
    function (err) {
      if (err) throw err;
      console.log('step4 end\n');
    }
  );
  for (var i = 0; i < 5; i++) {
    q.push(i);
  }
  q.complete();
}
