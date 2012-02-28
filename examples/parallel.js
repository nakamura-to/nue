var flow = require('../index').flow;
var parallel = require('../index').parallel;

var myFlow = flow('main')(
  function one() { this.next(); },
  function two() { this.next(); },
  parallel('par1')(
    flow('par1-1')(
      function three() { this.next(); },
      function four() { this.next(); }
    ),
    flow('par1-2')(
      function five() { this.next(); },
      function six() { this.next(); }
    )
  ),
  function seven() { this.next(); },
  function eight() { this.next(); },
  function allDone() {
    console.log(this.history);
    if (this.err) throw this.err;
    this.next();
  }
);

myFlow('file1', 'file2');