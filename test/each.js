var nue = require('../lib/nue');
var start = nue.start;
var flow = nue.flow;
var each = nue.each;
var assert = require('assert');

describe('each', function() {
  it('should handle results in the end function', function (done) {
    start([1, 2, 3], flow(
      each(
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
      )
    ));
  });
  it('should call the end function with the context for serialEach', function (done) {
    var context = {};
    each(
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
    start([1, 2, 3], flow(
      each(
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
          done();
        }
      )
    ));
  });
  it('should be called from flow', function (done) {
    start([1, 2, 3], flow(
      function (values) {
        this.data = 100;
        this.next(values);
      },
      each(
        function (values) {
          this.next(values);
        },
        function (i) {
          this.data += i;
          this.next();
        },
        function (err, results) {
          this.next(this.data);
        }
      ),
      function (value) {
        assert.strictEqual(value, 106);
        assert.strictEqual(this.data, 106);
        done();
      }
    ));
  });

});