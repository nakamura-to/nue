var nue = require('../lib/nue');
var start = nue.start;
var parallelEach = nue.parallelEach;
var assert = require('assert');

describe('parallelEach', function() {
  it('should handle results in the end function', function (done) {
    start([1, 2, 3], parallelEach(
      function (values) {
        this.fork(values);
      },
      function (value) {
        this.join(value * 2);
      },
      function (err, results) {
        assert.strictEqual(err, null);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    ));
  });
  it('should accept batch size', function (done) {
    start([1, 2, 3], parallelEach(1)(
      function (values) {
        this.fork(values);
      },
      function (value) {
        this.join(value * 2);
      },
      function (err, results) {
        assert.strictEqual(err, null);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 2);
        assert.strictEqual(results[1], 4);
        assert.strictEqual(results[2], 6);
        done();
      }
    ));
  });
  it('should handle err in the end function', function (done) {
    start([1, 2, 3], parallelEach(
      function (values) {
        this.fork(values);
      },
      function () {
        this.end('ERROR');
      },
      function (err, results) {
        assert.strictEqual(err, 'ERROR');
        assert.strictEqual(results, undefined);
        done();
      }
    ));
  });
  it('should call the end function with the context for parallelEach', function (done) {
    var context = {};
    parallelEach(
      function (values) {
        this.fork(values);
      },
      function (value) {
        this.join(value * 2);
      },
      function (err, results) {
        assert.strictEqual(err, null);
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