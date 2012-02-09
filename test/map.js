var nue = require('../lib/nue');
var flow = nue.flow;
var map = nue.map;
var assert = require('assert');

describe('map', function() {
  it('should chain functions with "next"', function (done) {
    flow(
      function () {
        this.next(1, 2, 3);
      },
      map(function () {
        this.next();
      }),
      map(function () {
        this.next();
      }),
      function () {
        assert.ok(!this.err);
        done();
      }
    )();
  });

  it('should chain functions with "callback"', function (done) {
    flow(
      function () {
        this.async(1, 2, 3)();
      },
      map(function () {
        this.async()();
      }),
      map(function () {
        this.async()();
      }),
      function () {
        assert.ok(!this.err);
        done();
      }
    )();
  });

  it('should accept an array argument on startup', function (done) {
    flow(
      map(function (value) {
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

  it('should accept an array argument from the previous function', function (done) {
    flow(
      function () {
        this.next([1, 2, 3]);
      },
      map(function (value) {
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
    )();
  });

  it('should accept multiple arguments from the previous function', function (done) {
    flow(
      function () {
        this.next(1, 2, 3);
      },
      map(function (value) {
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
    )();
  });

  it('should determine the first and the last', function (done) {
    flow(
      map(function () {
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
        assert.ok(!this.err);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 'first');
        assert.strictEqual(results[1], undefined);
        assert.strictEqual(results[2], 'last');
        done();
      }
    )([1, 2, 3]);
  });

  it('should exit with the "end"', function (done) {
    flow(
      map(function (i) {
        if (this.index === 1) {
          this.end('ERROR', 'aaa', 123);
        } else {
          this.next(i);
        }
      }),
      function (string, number) {
        assert.strictEqual('ERROR', this.err);
        assert.strictEqual(string, 'aaa');
        assert.strictEqual(number, 123);
        done();
      }
    )([1, 2, 3]);
  });

  it('should throw Error if no worker specified', function (done) {
    var exception;
    try {
      map();
    } catch (e) {
      exception = e;
    }
    assert.ok(exception instanceof Error);
    done();
  });
});