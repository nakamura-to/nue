var nue = require('../lib/nue');
var flow = nue.flow;
var parallelEach = nue.parallelEach;
var assert = require('assert');

describe('parallelEach', function() {
  it('should handle results in the end callback', function (done) {
    flow(
      function (values) {
        this.next(null, values);
      },
      parallelEach(function (_, value) {
        this.join(null, value * 2);
      }),
      function (err, results) {
        assert.strictEqual(err, null);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    )([1, 2, 3]);
  });
  it('should accept batch size', function (done) {
    flow(
      function (values) {
        this.next(null, values);
      },
      parallelEach(1)(function (_, value) {
        this.join(null, value * 2);
      }),
      function (err, results) {
        assert.strictEqual(err, null);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    )([1, 2, 3]);
  });
  it('should handle err in the end callback', function (done) {
    flow(
      function (values) {
        this.next(null, values);
      },
      parallelEach(function (_, value) {
        this.join('ERROR');
      }),
      function (err, results) {
        assert.strictEqual(err, 'ERROR');
        assert.strictEqual(results, undefined);
        done();
      }
    )([1, 2, 3]);
  });
  it('should exit from the parallel loop with the end function', function (done) {
    flow(
      function () {
        this.next(null, [1, 2, 3]);
      },
      parallelEach(function (_, i) {
        if (i === 2) {
          this.end('ERROR');
        } else {
          this.join();
        }
      }),
      function (err) {
        assert.strictEqual(err, 'ERROR');
        done();
      }
    )();
  });
});