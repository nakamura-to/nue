var flow = require('../index').flow;

function sleep(flow, ms) {
  setTimeout(function () {
    flow.next();
  }, ms);
}

flow(
  function () {
    console.log('wait... ' + new Date());
    sleep(this, 1000);
  },
  function () {
    console.log('ok... ' + new Date());
    this.next();
  }
)();

console.log('back in main');
