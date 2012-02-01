var nue = require('../lib/nue');
var parallelQueue = nue.parallelQueue;
var assert = require('assert');

describe('parallelQueue', function() {
  it('should handle results in the callback', function (done) {
    var q = parallelQueue(
      function (i) {
        this.join(i * 2);
      },
      function (err, results) {
        assert.strictEqual(err, null);
        assert.strictEqual(results.length, 5);
        assert.strictEqual(results[0], 0);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 4);
        assert.strictEqual(results[3], 6);
        assert.strictEqual(results[4], 8);
        done();
      }
    );
    for (var i = 0; i < 5; i++) {
      q.push(i);
    }
    q.complete();
  });
  it('should handle err in the callback', function (done) {
    var q = parallelQueue(
      function (i) {
        if (i === 3) {
          this.err('ERROR:' + i);
        }
      },
      function (err, results) {
        assert.strictEqual(err, 'ERROR:3');
        assert.strictEqual(results, null);
        done();
      }
    );
    for (var i = 0; i < 5; i++) {
      q.push(i);
    }
    q.complete();
  });

});