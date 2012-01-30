var nue = require('../lib/nue');
var assert = require('assert');

describe('parallel', function() {
  it('should handle results in the callback', function (done) {
    nue.parallel([
      function () {
        assert.strictEqual(this.index, 0);
        this.join(1);
      },
      function () {
        var self = this;
        assert.strictEqual(this.index, 1);
        setTimeout(function () {
          self.join(2);
        }, 10)
      },
      function () {
        assert.strictEqual(this.index, 2);
        this.join(3);
      }],
      function (err, results) {
        assert.strictEqual(err, null);
        assert.strictEqual(results.length, 3, results);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )();
  });
  it('should handle err in the callback', function (done) {
    nue.parallel([
      function () {
        this.join(1);
      },
      function () {
        this.err('ERROR');
      },
      function () {
        this.join(3);
      }],
      function (err, results) {
        assert.strictEqual(err, 'ERROR');
        assert.strictEqual(results, null);
        done();
      }
    )();
  });
  it('should accept arguments', function (done) {
    nue.parallel([
      function (a, b) {
        this.join(a + b);
      },
      function (a, b) {
        var self = this;
        setTimeout(function () {
          self.join(a + b);
        }, 10)
      },
      function (a, b) {
        this.join(a + b);
      }],
      function (err, results) {
        assert.strictEqual(err, null);
        assert.strictEqual(results.length, 3, results);
        assert.strictEqual(results[0], 3);
        assert.strictEqual(results[1], 3);
        assert.strictEqual(results[2], 3);
        done();
      }
    )(1, 2);
  });
  it('should work without callback', function () {
    nue.parallel(
      function () {
        this.join(1);
      },
      function () {
        this.join(2);
      },
      function () {
        this.join(3);
      }
    )();
  });

});