var flow = require('../index').flow;

flow(
  function () {
    console.log('a');
    this.next();
  },
  flow(
    function () {
      console.log('b');
      this.next();
    },
    function () {
      console.log('c');
      this.next();
    },
    function () {
      console.log('d');
      throw new Error('hoge');
    }
  ),
  function () {
    console.log('e');
    this.next();
  },
  function () {
    if (this.err) {
      console.log('f');
      this.err = null;
    }
    console.log('g');
    console.log('done');
    this.next();
  }
)();
