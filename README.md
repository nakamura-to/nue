nue — An async control-flow library suited for the node event loop
===================================================================

nue is an async control-flow library.

## Installing

```
$ npm install nue
```

## Example

> JavaScript

```js
var nue = require('nue');

step1();

function step1() {
  console.log('step1 start');
  nue.parallel([
    function(){
      console.log('aaa');
    },
    function(){
      console.log('bbb');
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
      console.log('ccc');
      this.next('test', 2);
    },
    function (a, b){
      console.log('ddd ' + a + b);
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
  for (var i = 0; i < 10; i++) {
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
  for (var i = 0; i < 10; i++) {
    q.push(i);
  }
  q.complete();
}
```

> Result

```
step1 start
aaa:
bbb:
step1 end

step2 start
ccc:
ddd: test, 2
step2 end

step3 start
data: 0
data: 1
data: 2
data: 3
data: 4
step3 end

step4 start
data: 0
data: 1
data: 2
data: 3
data: 4
step4 end
```
