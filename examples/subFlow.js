var flow = require('../lib/nue').flow;
var fs = require('fs');

flow(
  function () {
    console.log('a');
    this.next();
  },
  flow(
    function () {
      console.log('b');
      throw new Error('hoge');
    },
    function () {
      console.log('c');
      this.next();
    },
    function () {
      if (this.err) {
        this.err = null;
      }
      console.log('d');
      this.next();
    }
  ),
  function () {
    console.log('e');
    this.next();
  },
  function () {
    if (this.err) throw this.err;
    console.log('f');
    this.next();
  }
)();
