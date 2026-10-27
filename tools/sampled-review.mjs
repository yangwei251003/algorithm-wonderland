// A bounded visual review is useful evidence, never a substitute for listening
// and continuous playback. Historical reviewers used several field spellings.
const acceptedStatuses=new Set([
 'sampled-visual-pass','sampled-visual-and-numeric-review-passed',
 'bounded-sample-review-no-material-findings',
 'bounded-sample-review-complete-no-blocking-findings',
]);
export function sampledMovieReview(review,sha256){
 if(!review||!sha256)return false;
 const recorded=review.mp4Sha256??review.movieSha256??review.reviewedFilm?.sha256??review.sha256;
 if(recorded!==sha256||review.requiresRerender===true)return false;
 const status=review.status??review.reviewStatus;
 if(status)return acceptedStatuses.has(status);
 return review.visual==='passed'&&review.audioListened===false;
}
