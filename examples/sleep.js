var flow = require('../index').flow;

function sleep(flow, ms) {
  setTimeout(function () {
    flow.next();
  }, ms);
}

flow(
  function start() {
    console.log('wait... ' + new Date());
    sleep(this, 1000);
  },
  function end() {
    console.log('ok... ' + new Date());
    this.next();
  }
)();

console.log('back in main');
