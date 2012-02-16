var nue = require('../lib/nue');
var flow = nue.flow;
var parallelMap = nue.parallelMap;
var assert = require('assert');

describe('parallelMap', function() {
  it('should handle results in the end callback', function (done) {
    flow(
      function (values) {
        this.next(values);
      },
      parallelMap(function (value) {
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

  it('should accept batch size', function (done) {
    flow(
      function (values) {
        this.next(values);
      },
      parallelMap(1)(function (value) {
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

  it('should handle err in the end callback', function (done) {
    flow(
      function (values) {
        this.next(values);
      },
      parallelMap(function () {
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
      parallelMap(function (i) {
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
      parallelMap();
    } catch (e) {
      exception = e;
    }
    assert.ok(exception instanceof Error);
    done();
  });

  it('should accept result from inner flow', function (done) {
    var myFlow = flow(
      function (i) {
        this.next(i + 1);
      },
      function (i) {
        this.next(i + 1);
      }
    );
    flow(
      parallelMap(
        myFlow
      ),
      function (results) {
        assert.deepEqual(results, [3]);
        done();
      }
    )(1);
  });

  it('should provide flow local data', function (done) {
    flow(
      function () {
        this.data.array = [];
        this.next(1, 2, 3);
      },
      parallelMap(function (i) {
        this.data.array[this.index] = i * 2;
        this.next();
      }),
      function () {
        assert.deepEqual(this.data.array, [2, 4, 6]);
        done();
      }
    )();
  });
});