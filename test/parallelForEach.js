var nue = require('../lib/nue');
var flow = nue.flow;
var parallelForEach = nue.parallelForEach;
var assert = require('assert');

describe('parallelForEach', function() {
  it('should chain functions with "next"', function (done) {
    flow(
      function (values) {
        this.next(values);
      },
      parallelForEach(function (value) {
        this.next(value * 2);
      }),
      function (results) {
        assert.ok(!this.err);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    )([1, 2, 3]);
  });

});