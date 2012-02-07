var nue = require('../lib/nue');
var flow = nue.flow;
var each = nue.each;
var assert = require('assert');

describe('each', function() {
  it('should chain functions with "next"', function (done) {
    flow(
      function () {
        this.next(1, 2, 3);
      },
      each(function () {
        this.next();
      }),
      each(function () {
        this.next();
      }),
      function () {
        if (this.err) throw this.err;
        done();
      }
    )();
  });

  it('should chain functions with "callback"', function (done) {
    flow(
      function () {
        this.callback(null, 1, 2, 3);
      },
      each(function () {
        this.callback();
      }),
      each(function () {
        this.callback();
      }),
      function () {
        if (this.err) throw this.err;
        done();
      }
    )();
  });

  it('should accept arguments on startup', function (done) {
    flow(
      each(function (value) {
        this.next(value * 2);
      }),
      function (results) {
        if (this.err) throw this.err;
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    )([1, 2, 3]);
  });

  it('should accept array argument from the previous function', function (done) {
    flow(
      function () {
        this.next([1, 2, 3]);
      },
      each(function (value) {
        this.next(value * 2);
      }),
      function (results) {
        if (this.err) throw this.err;
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    )();
  });

  it('should accept multiple arguments from the previous function', function (done) {
    flow(
      function () {
        this.next(1, 2, 3);
      },
      each(function (value) {
        this.next(value * 2);
      }),
      function (results) {
        if (this.err) throw this.err;
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    )();
  });

  it('should determine the first and the last', function (done) {
    flow(
      each(function () {
        var result;
        if (this.isFirst) {
          result = 'first';
        }
        if (this.isLast) {
          result = 'last';
        }
        this.next(result);
      }),
      function (results) {
        if (this.err) throw this.err;
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 'first');
        assert.strictEqual(results[1], undefined);
        assert.strictEqual(results[2], 'last');
        done();
      }
    )([1, 2, 3]);
  });

  it('should exit from the loop with the end function', function (done) {
    flow(
      each(function (i) {
        this.data = i;
        if (this.index === 1) {
          this.end('ERROR', 'aaa', 123);
        } else {
          this.next();
        }
      }),
      function (string, number) {
        assert.strictEqual('ERROR', this.err);
        assert.strictEqual(string, 'aaa');
        assert.strictEqual(number, 123);
        assert.strictEqual(2, this.data);
        done();
      }
    )([1, 2, 3]);
  });

  it('should throw Error for an invalid argument', function (done) {
    var exception;
    try {
      each();
    } catch (e) {
      exception = e;
    }
    assert.ok(exception instanceof Error);
    done();
  });
});