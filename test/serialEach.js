var nue = require('../lib/nue');
var start = nue.start;
var serialEach = nue.serialEach;
var assert = require('assert');

describe('serialEach', function() {
  it('should handle results in the end function', function (done) {
    start([1, 2, 3], serialEach(
      function (values) {
        this.begin(values);
      },
      function (value, acc) {
        acc = acc || [];
        acc.push(value * 2);
        this.next(acc);
      },
      function (results) {
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
        this.begin(values);
      },
      function (value, acc) {
        acc = acc || [];
        acc.push(value * 2);
        this.next(acc);
      },
      function (results) {
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        assert.strictEqual(this, context);
        done();
      }
    ).call(context, [1, 2, 3]);
  });

});