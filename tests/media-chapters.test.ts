import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// @ts-expect-error local packaging helper is JavaScript
import {buildMovieChapters} from '../tools/media-chapters.mjs';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function exported(query: string, events = ['0', '1', '7']) {
  const trace = {algorithmId: 'bloom', events: events.map(id => ({id})), finalState: {query}};
  return {algorithm: {id: 'bloom'}, lesson: {algorithmId: 'bloom', teachingCase: {input: {text: query}, params: {query}, seed: 42}},
    run: {trace}, traceHash: hash(JSON.stringify(trace))};
}
function setup() {
  const other = exported('q');
  const bytes = Buffer.from(JSON.stringify(other));
  const film: any = {...exported('d'), beats: [
    {id: 'intro'}, {id: 'main', eventIds: ['1']},
    {id: 'contrast', caseFile: 'counterexample.json', caseEventIds: ['7']},
    {id: 'same-case', caseFile: 'counterexample.json', caseEventIds: ['1']},
    {id: 'outro', eventIds: ['7']},
  ]};
  const report: any = {algorithmId: 'bloom', traceHash: film.traceHash, additionalCases: [
    {file: 'counterexample.json', sha256: hash(bytes), traceHash: other.traceHash},
  ], chapters: [
    {id: 'intro', title: '类比', start: 0, eventIds: []},
    {id: 'main', title: '主例', start: 10, eventIds: ['1']},
    {id: 'contrast', title: '反例', start: 20, eventIds: [], caseFile: 'counterexample.json'},
    {id: 'same-case', title: '反例后续', start: 30, eventIds: []},
    {id: 'outro', title: '总结', start: 40, eventIds: []},
  ]};
  let reads = 0;
  const read = async (filename: string) => {assert.equal(filename, 'counterexample.json'); reads++; return bytes;};
  return {other, bytes, film, report, read, reads: () => reads};
}

test('main and counterexample chapters use their own real inputs, trace hashes, and event sources', async () => {
  const s = setup();
  const result = await buildMovieChapters('bloom', s.report, s.film, s.read);
  assert.deepEqual(result[1], {title: '主例', start: 10, eventId: '1', teachingCase: s.film.lesson.teachingCase, caseTraceHash: s.film.traceHash});
  assert.deepEqual(result[2], {title: '反例', start: 20, eventId: '7', teachingCase: s.other.lesson.teachingCase, caseTraceHash: s.other.traceHash, caseFile: 'counterexample.json'});
  assert.equal(result[3].eventId, '1');
  assert.equal(s.reads(), 1, 'repeated beats share one verified file read');
  result[2].teachingCase.params.query = 'mutated';
  assert.equal(result[3].teachingCase.params.query, 'q', 'output chapter inputs do not alias each other');
});

test('chapters without event IDs produce no jump, even if a main beat mentions an event', async () => {
  const s = setup();
  s.film.beats[2].caseEventIds = [];
  s.film.beats[3].caseEventIds = undefined;
  const result = await buildMovieChapters('bloom', s.report, s.film, s.read);
  for (const i of [0, 2, 3, 4]) assert.deepEqual(result[i], {title: s.report.chapters[i].title, start: s.report.chapters[i].start});
  assert.equal(s.reads(), 0);
});

test('tampered file bytes and absent or contradictory production bindings are rejected', async () => {
  const s = setup();
  await assert.rejects(buildMovieChapters('bloom', s.report, s.film, async () => Buffer.concat([s.bytes, Buffer.from(' ')])), /SHA-256/);
  s.report.additionalCases.push({...s.report.additionalCases[0], sha256: 'a'.repeat(64)});
  await assert.rejects(buildMovieChapters('bloom', s.report, s.film, s.read), /SHA-256/);
  s.report.additionalCases = [];
  await assert.rejects(buildMovieChapters('bloom', s.report, s.film, s.read), /绑定/);
});

test('matching file hash alone cannot conceal a forged trace hash or different algorithm', async () => {
  for (const change of ['forged-trace', 'different-algorithm', 'report-trace']) {
    const s = setup();
    const modified = structuredClone(s.other);
    if (change === 'forged-trace') modified.run.trace.finalState.query = 'tampered';
    if (change === 'different-algorithm') modified.lesson.algorithmId = 'sha256';
    const bytes = Buffer.from(JSON.stringify(modified));
    s.report.additionalCases[0].sha256 = hash(bytes);
    if (change === 'report-trace') s.report.additionalCases[0].traceHash = 'a'.repeat(64);
    await assert.rejects(buildMovieChapters('bloom', s.report, s.film, async () => bytes), /traceHash|算法 ID/);
  }
});

test('unknown main or counterexample events and invalid numeric IDs are rejected', async () => {
  for (const invalid of ['999', '-1', '1.5', '', '01', 'NaN', '9007199254740992', null]) {
    const main = setup(); main.report.chapters[1].eventIds = [invalid];
    await assert.rejects(buildMovieChapters('bloom', main.report, main.film, main.read), /未知事件|非负安全整数/);
    const contrast = setup(); contrast.film.beats[2].caseEventIds = [invalid];
    await assert.rejects(buildMovieChapters('bloom', contrast.report, contrast.film, contrast.read), /未知事件|非负安全整数/);
  }
});

test('all path traversal and Windows special paths fail before readCase is invoked', async () => {
  for (const file of ['../case.json', '..\\case.json', '/case.json', 'C:\\case.json', 'C:case.json', 'folder/case.json', 'folder\\case.json', '.', '..', 'case.json:stream', 'case.json ', 'NUL.json', 'case\0.json']) {
    const s = setup(); s.film.beats[2].caseFile = file; s.report.chapters[2].caseFile = file;
    await assert.rejects(buildMovieChapters('bloom', s.report, s.film, s.read), /basename/);
    assert.equal(s.reads(), 0);
  }
});

test('chapter/beat and report/algorithm identity mismatches fail closed', async () => {
  const missing = setup(); missing.report.chapters[1].id = 'missing';
  await assert.rejects(buildMovieChapters('bloom', missing.report, missing.film, missing.read), /不存在/);
  const mismatch = setup(); mismatch.report.chapters[2].caseFile = 'another.json';
  await assert.rejects(buildMovieChapters('bloom', mismatch.report, mismatch.film, mismatch.read), /反例文件不一致/);
  const identity = setup(); identity.report.algorithmId = 'sha256';
  await assert.rejects(buildMovieChapters('bloom', identity.report, identity.film, identity.read), /报告与主案例/);
});

test('event zero remains a jump and numeric IDs normalize to the existing string contract', async () => {
  const s = setup(); s.report.chapters[1].eventIds = [0]; s.film.beats[2].caseEventIds = [0];
  const result = await buildMovieChapters('bloom', s.report, s.film, s.read);
  assert.equal(result[1].eventId, '0'); assert.equal(result[2].eventId, '0');
});
