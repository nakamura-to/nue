var nue = require('../lib/nue');
var flow = nue.flow;
var parallelSome = nue.parallelSome;
var assert = require('assert');

describe('parallelSome', function() {
  it('#true"', function (done) {
    flow(
      function () {
        this.next(1, 2, -3, 4, 5);
      },
      parallelSome(function (i) {
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

describe('parallelSome', function() {
  it('#false', function (done) {
    flow(
      function () {
        this.next(1, 2, 3, 4, 5);
      },
      parallelSome(function (i) {
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