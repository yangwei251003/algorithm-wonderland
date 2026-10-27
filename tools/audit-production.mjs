import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {movieHold} from './media-holds.mjs';
import {sampledMovieReview} from './sampled-review.mjs';
const read=async file=>JSON.parse(await readFile(file,'utf8').catch(()=>'null'));
const contract=await read('qa/v2-teaching-contract.json'),interactive=await read('qa/v2-remotion-interactions-report.json');
const holds=await read('qa/v2-media-holds.json');
const rows=[];
for(const item of contract.rows){
 const id=item.id,review=await read(`media/comics/${id}/review.json`),report=await read(`media/films/${id}/report.json`),filmReview=await read(`media/films/${id}/review.json`);
 const images=[];
 if(review?.traceHash===item.traceHash)for(const comic of review.comics??[])if(comic.status==='passed'&&await stat(`media/comics/${id}/${comic.file}`).catch(()=>null))images.push(comic.role);
 let technicalFilm=false;
 if(report?.width===1920&&report.height===1080&&Math.abs(report.fps-60)<.001&&report.duration>=90&&report.duration<=150&&report.completeDecode&&report.traceHash===item.traceHash){const bytes=await readFile(`media/films/${id}/final.mp4`).catch(()=>null),input=await readFile(`media/exports/${id}.film.json`).catch(()=>null);technicalFilm=!!bytes&&!!input&&createHash('sha256').update(bytes).digest('hex')===report.sha256&&createHash('sha256').update(input).digest('hex')===report.inputSha256;}
 const held=!!movieHold(holds,id,report?.sha256);
 const boundedReview=await read(`qa/film-final-review/${id}/review.json`);
 const sampledVisual=technicalFilm&&!held&&sampledMovieReview(boundedReview,report?.sha256);
 const filmPassed=technicalFilm&&!held&&filmReview?.sha256===report.sha256&&filmReview.visual==='passed'&&filmReview.audio==='passed';
 const script=await read(`media/scripts/${id}.json`),alignment=await read(`media/films/${id}/audio/aligned.json`);
 const narration=!!script&&!!alignment&&alignment.duration+1.2>=90&&alignment.duration+1.2<=150&&alignment.lines.length===script.beats.length&&alignment.lines.every((line,i)=>line.caption===script.beats[i].text)&&!!await stat(`media/films/${id}/audio/voice.wav`).catch(()=>null);
 rows.push({id,name:item.name,principles:item.status==='contract-pass',references:item.visualSources>=3,comics:images.length,script:!!script,narration,technicalFilm,held,sampledVisual,filmPassed,interactive:interactive.expectedIds.includes(id)?interactive.checks.some(c=>c.id===id&&c.passed):null});
}
const totals={principles:rows.filter(r=>r.principles).length,references:rows.filter(r=>r.references).length,comics:rows.reduce((n,r)=>n+r.comics,0),scripts:rows.filter(r=>r.script).length,narrations:rows.filter(r=>r.narration).length,technicalFilms:rows.filter(r=>r.technicalFilm).length,heldMovies:rows.filter(r=>r.held).length,sampledVisualFilms:rows.filter(r=>r.sampledVisual).length,reviewedFilms:rows.filter(r=>r.filmPassed).length,interactive:rows.filter(r=>r.interactive).length};
const complete=totals.principles===84&&totals.references===84&&totals.comics===252&&totals.reviewedFilms===84&&totals.interactive===16;
await writeFile('qa/v2-production-ledger.json',JSON.stringify({checkedAt:new Date().toISOString(),complete,totals,rows,scope:'技术成片不等于完整视听审查；媒体总数未齐不报告全量完成。'},null,2));
const yes=value=>value?'✓':'待完成';
await writeFile('docs/v2/制作总表.md',`# 算法奇境2.0实际制作进度\n\n更新时间：${new Date().toISOString()}。全量完成：${complete?'是':'否'}。\n\n真实教学 ${totals.principles}/84；漫画 ${totals.comics}/252；符合技术规格的视频 ${totals.technicalFilms}/84；当前成片采样画面审查 ${totals.sampledVisualFilms}/84；完整视听审查 ${totals.reviewedFilms}/84；Remotion ${totals.interactive}/16。\n\n| 展项 | 三份调研 | 真实原理 | 漫画 | 手写脚本 | 配音 | 高清规格 | 已知错误隔离 | 采样画面审查 | 完整视听审查 | Remotion |\n|---|---|---|---|---|---|---|---|---|---|---|\n`+rows.map(r=>`|${r.name}|${yes(r.references)}|${yes(r.principles)}|${r.comics}/3|${yes(r.script)}|${yes(r.narration)}|${yes(r.technicalFilm)}|${r.held?'已隔离旧片':'无命中'}|${yes(r.sampledVisual)}|${yes(r.filmPassed)}|${r.interactive===null?'不要求':yes(r.interactive)}|`).join('\n')+'\n');
console.log(JSON.stringify({complete,totals}));
