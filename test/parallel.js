var parallel = require('../lib/nue').parallel;
var assert = require('assert');

describe('parallel', function() {
  it('should handle results in the end function', function (done) {
    parallel(
      function () {
        this.fork();
      },
      [
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
        }
      ],
      function (err, results) {
        assert.strictEqual(err, null);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )();
  });
  it('should handle err in the end function', function (done) {
    parallel([
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
    parallel(
      function (a, b, c) {
        this.fork(a, b, c);
      },
      [ 
        function (a) {
          this.join(a);
        },
        function (b) {
          var self = this;
          setTimeout(function () {
            self.join(b);
          }, 10);
        },
        function (c) {
          this.join(c);
        }
      ],
      function (err, results) {
        assert.strictEqual(err, null);
        assert.strictEqual(results.length, 3, results);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )(1, 2, 3);
  });
  it('should work without begin function', function (done) {
    parallel([
      function () {
        this.join(1);
      },
      function () {
        this.join(2);
      },
      function () {
        this.join(3);
      }],
      function (err, results) {
        done();
      }
    )();
  });
  it('should work without end function', function () {
    parallel(
      function () {
        this.fork();
      },
      [
        function () {
          this.join(1);
        },
        function () {
          this.join(2);
        },
        function () {
          this.join(3);
        }
      ]
    )();
  });
});