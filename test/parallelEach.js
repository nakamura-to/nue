var nue = require('../lib/nue');
var flow = nue.flow;
var parallelEach = nue.parallelEach;
var assert = require('assert');

describe('parallelEach', function() {
  it('should handle results in the end callback', function (done) {
    flow(
      function (values) {
        this.next(values);
      },
      parallelEach(function (value) {
        this.next(value * 2);
      }),
      function (results) {
        assert.strictEqual(this.err, undefined);
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
        this.next(values);
      },
      parallelEach(1)(function (value) {
        this.next(value * 2);
      }),
      function (results) {
        assert.strictEqual(this.err, undefined);
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
        this.next(values);
      },
      parallelEach(function () {
        this.end('ERROR');
      }),
      function (results) {
        assert.strictEqual(this.err, 'ERROR');
        assert.strictEqual(results, undefined);
        done();
      }
    )([1, 2, 3]);
  });

  it('should exit from the parallel loop with the end function', function (done) {
    flow(
      function () {
        this.next([1, 2, 3]);
      },
      parallelEach(function (i) {
        if (i === 2) {
          this.end('ERROR');
        } else {
          this.next();
        }
      }),
      function () {
        assert.strictEqual(this.err, 'ERROR');
        done();
      }
    )();
  });

  it('should throw Error for an invalid argument', function (done) {
    var exception;
    try {
      parallelEach();
    } catch (e) {
      exception = e;
    }
    assert.ok(exception instanceof Error);
    done();
  });

});