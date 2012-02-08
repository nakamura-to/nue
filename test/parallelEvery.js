var nue = require('../lib/nue');
var flow = nue.flow;
var parallelEvery = nue.parallelEvery;
var assert = require('assert');

describe('parallelEvery', function() {
  it('#true', function (done) {
    flow(
      function () {
        this.next(1, 2, 3, 4, 5);
      },
      parallelEvery(function (i) {
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
      parallelEvery(function (i) {
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
