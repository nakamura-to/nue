var nue = require('../lib/nue');
var flow = nue.flow;
var each = nue.each;
var assert = require('assert');

describe('each', function() {
  it('should handle results in the end callback', function (done) {
    flow(
      each(function (value) {
        this.next(value * 2);
      }),
      function (results) {
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    )([1, 2, 3]);
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
          this.end('ERROR');
        } else {
          this.next();
        }
      }),
      function (err) {
        assert.strictEqual('ERROR', err);
        assert.strictEqual(2, this.data);
        done();
      }
    )([1, 2, 3]);
  });

});