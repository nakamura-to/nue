var nue = require('../lib/nue');
var flow = nue.flow;
var parallel = nue.parallel;
var assert = require('assert');

describe('parallel', function() {
  it('should handle results in the end callback', function (done) {
    flow(
      parallel(
        [
          function () {
            this.join(null, 1);
          },
          function () {
            var self = this;
            setTimeout(function () {
              self.join(null, 2);
            }, 10)
          },
          function () {
            this.join(null, 3);
          }
        ]
      ),
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
  it('should handle err in the end callback', function (done) {
    flow(
      parallel(
        [ 
          function () {
            this.join(null, 1);
          },
          function () {
            this.end('ERROR');
          },
          function () {
            this.join(null, 3);
          }
        ]
      ),
      function (err, results) {
        assert.strictEqual(err, 'ERROR');
        assert.strictEqual(results, undefined);
        done();
      }
    )();
  });
  it('should accept arguments', function (done) {
    flow(
      parallel(
        [ 
          function (a) {
            this.join(null, a);
          },
          function (b) {
            var self = this;
            setTimeout(function () {
              self.join(null, b);
            }, 10);
          },
          function (c) {
            this.join(null, c);
          }
        ]
      ),
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
  it('should work without end callback', function () {
    flow(
      parallel(
        [
          function () {
            this.join(null, 1);
          },
          function () {
            this.join(null, 2);
          },
          function () {
            this.join(null, 3);
          }
        ]
      )
    )();
  });
  it('should exit from the parallel execution with the end function', function (done) {
    flow(
      parallel(
        [
          function () {
            this.join(null, 1);
          },
          function () {
            this.end('ERROR');
          },
          function () {
            this.join(null, 3);
          }
        ]
      ),
      function (err) {
        assert.strictEqual(err, 'ERROR');
        done();
      }
    )();
  });
});