var flow = require('../index').flow;

flow(
  function step1() {
    console.log('a');
    this.next();
  },
  flow(
    function subStep1() {
      console.log('b');
      this.next();
    },
    function subStep2() {
      console.log('c');
      this.next();
    },
    function subStep3() {
      console.log('d');
      throw new Error('hoge');
    }
  ),
  function step2() {
    console.log('e');
    this.next();
  },
  function step3() {
    if (this.err) {
      console.log('f');
      this.err = null;
    }
    console.log('g');
    console.log('done');
    this.next();
  }
)();
