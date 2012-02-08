var nue = require('../lib/nue');
var flow = nue.flow;
var filter = nue.filter;
var assert = require('assert');

describe('filter', function() {
  it('should chain with "next"', function (done) {
    flow(
      function () {
        this.next(1, 2, 3, 4, 5);
      },
      filter(function (i) {
        this.next(i > 1);
      }),
      filter(function (i) {
        this.next(i < 4);
      }),
      function (results) {
        assert.ok(!this.err);
        assert.deepEqual(results, [2, 3]);
        done();
      }
    )();
  });
});
