var nue = require('../lib/nue');
var flow = nue.flow;
var some = nue.some;
var assert = require('assert');

describe('some', function() {
  it('#true"', function (done) {
    flow(
      function () {
        this.next(1, 2, -3, 4, 5);
      },
      some(function (i) {
        this.next(i > 0);
      }),
      function (result) {
        assert.ok(!this.err);
        assert.strictEqual(result, true);
        done();
      }
    )();
  });
});

describe('some', function() {
  it('#false', function (done) {
    flow(
      function () {
        this.next(1, 2, 3, 4, 5);
      },
      some(function (i) {
        this.next(i < 0);
      }),
      function (result) {
        assert.ok(!this.err);
        assert.strictEqual(result, false);
        done();
      }
    )();
  });
});