var nue = require('../lib/nue');
var flow = nue.flow;
var every = nue.every;
var assert = require('assert');

describe('every', function() {
  it('#true', function (done) {
    flow(
      function () {
        this.next(1, 2, 3, 4, 5);
      },
      every(function (i) {
        this.next(i > 0);
      }),
      function (result) {
        assert.ok(!this.err);
        assert.ok(result);
        done();
      }
    )();
  });

  it('#false', function (done) {
    flow(
      function () {
        this.next(1, 2, -3, 4, 5);
      },
      every(function (i) {
        this.next(i > 0);
      }),
      function (result) {
        assert.ok(!this.err);
        assert.ok(!result);
        done();
      }
    )();
  });

});
