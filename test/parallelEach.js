var parallelEach = require('../lib/nue').parallelEach;
var assert = require('assert');

describe('parallelEach', function() {
  it('should handle results in the end function', function (done) {
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
        done();
      }
    )([1, 2, 3]);
  });
  it('should accept batch size', function (done) {
    parallelEach(1)(
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
    )([1, 2, 3]);
  });

  it('should handle err in the end function', function (done) {
    parallelEach(
      function (values) {
        this.fork(values);
      },
      function () {
        this.err('ERROR');
      },
      function (err, results) {
        assert.strictEqual(err, 'ERROR');
        assert.strictEqual(results, null);
        done();
      }
    )([1, 2, 3]);
  });
});