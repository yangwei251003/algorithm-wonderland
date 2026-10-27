import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error local validation helper is JavaScript
import {sampledMovieReview} from '../tools/sampled-review.mjs';
test('a prior movie review never transfers to a newly rendered movie',()=>{
 assert.equal(sampledMovieReview({movieSha256:'old',status:'bounded-sample-review-no-material-findings'},'new'),false);
 assert.equal(sampledMovieReview({movieSha256:'new',status:'bounded-sample-review-no-material-findings',audioListened:false},'new'),true);
});
test('revision and unknown statuses fail closed even with an older visual pass',()=>{
 assert.equal(sampledMovieReview({sha256:'x',visual:'passed',audioListened:false,status:'needs-revision'},'x'),false);
 assert.equal(sampledMovieReview({sha256:'x',status:'sampled-visual-pass',requiresRerender:true},'x'),false);
 assert.equal(sampledMovieReview({sha256:'x',status:'unknown'},'x'),false);
});
test('legacy bounded reviews and nested movie bindings remain recognizable',()=>{
 assert.equal(sampledMovieReview({mp4Sha256:'x',reviewStatus:'bounded-sample-review-complete-no-blocking-findings'},'x'),true);
 assert.equal(sampledMovieReview({reviewedFilm:{sha256:'x'},status:'sampled-visual-and-numeric-review-passed'},'x'),true);
 assert.equal(sampledMovieReview({sha256:'x',visual:'passed',audioListened:false},'x'),true);
});
