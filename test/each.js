var nue = require('../lib/nue');
var start = nue.start;
var flow = nue.flow;
var each = nue.each;
var assert = require('assert');

describe('each', function() {
  it('should handle results in the end callback', function (done) {
    flow(
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
    )([1, 2, 3]);
  });
  it('should call the end callback with the context for each', function (done) {
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
    flow(
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
    )([1, 2, 3]);
  });
  it('should exit from the loop with the end function', function (done) {
    flow(
      each(
        function (values) {
          this.next(values);
        },
        function (i) {
          this.data = i;
          if (this.index === 1) {
            this.end('ERROR');
          } else {
            this.next();
          }
        },
        function (err, results) {
          assert.strictEqual('ERROR', err);
          assert.strictEqual(2, this.data);
          done();
        }
      ),
      function (err) {
      }
    )([1, 2, 3]);
  });

});