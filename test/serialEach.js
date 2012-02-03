var nue = require('../lib/nue');
var start = nue.start;
var serialEach = nue.serialEach;
var assert = require('assert');

describe('serialEach', function() {
  it('should handle results in the end function', function (done) {
    start([1, 2, 3], serialEach(
      function (values) {
        this.next(values);
      },
      function (value) {
        this.next(value * 2);
      },
      function (err, results) {
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    ));
  });
  it('should call the end function with the context for serialEach', function (done) {
    var context = {};
    serialEach(
      function (values) {
        this.next(values);
      },
      function () {
        this.next();
      },
      function () {
        assert.strictEqual(this, context);
        done();
      }
    ).call(context, [1, 2, 3]);
  });
  it('should determine the first and the last', function (done) {
    var context = {};
    serialEach(
      function (values) {
        this.next(values);
      },
      function () {
        var result;
        if (this.isFirst) {
          result = 'first';
        }
        if (this.isLast) {
          result = 'last';
        }
        this.next(result);
      },
      function (err, results) {
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 'first');
        assert.strictEqual(results[1], undefined);
        assert.strictEqual(results[2], 'last');
        assert.strictEqual(this, context);
        done();
      }
    ).call(context, [1, 2, 3]);
  });

});