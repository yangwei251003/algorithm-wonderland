import {createHash} from 'node:crypto';
import path from 'node:path';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function eventId(value) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^(0|[1-9]\d*)$/.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new Error('章节事件 ID 必须是非负安全整数');
  }
  return text;
}

function caseBasename(file) {
  // Both path dialects matter: the packager runs on Windows as well as CI.
  if (typeof file !== 'string' || !file || file === '.' || file === '..' ||
      file !== path.posix.basename(file) || file !== path.win32.basename(file) ||
      /[<>:"|?*\x00-\x1f]/.test(file) || /[. ]$/.test(file) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(file)) {
    throw new Error('反例文件必须是安全的 basename，不能包含路径');
  }
  return file;
}

function verifiedPackage(id, data) {
  const trace = data?.run?.trace;
  if (data?.algorithm?.id !== id || data?.lesson?.algorithmId !== id || trace?.algorithmId !== id ||
      (data.algorithmId !== undefined && data.algorithmId !== id)) {
    throw new Error('章节案例的算法 ID 不一致');
  }
  if (!Array.isArray(trace.events) || !isHash(data.traceHash) || sha256(JSON.stringify(trace)) !== data.traceHash) {
    throw new Error('章节案例的 traceHash 与真实轨迹不一致');
  }
  const teachingCase = data.lesson.teachingCase;
  if (!record(teachingCase) || !record(teachingCase.input) || !record(teachingCase.params) ||
      !Number.isSafeInteger(teachingCase.seed)) {
    throw new Error('章节案例缺少有效的 teachingCase');
  }
  const ids = new Set();
  for (const event of trace.events) {
    const key = eventId(event?.id);
    if (ids.has(key)) throw new Error('章节案例含重复事件 ID');
    ids.add(key);
  }
  return {ids, teachingCase, traceHash: data.traceHash};
}

/** Build jumps from the exact production input, never from the default lesson.
 * readCase receives a validated basename and must return the exported file bytes.
 * Exported non-finite values are already JSON objects, so JSON.stringify(trace)
 * preserves the teachingJSON representation used to create its SHA-256.
 */
export async function buildMovieChapters(id, report, filmPackage, readCase) {
  if (report?.algorithmId !== id || report.traceHash !== filmPackage?.traceHash) {
    throw new Error('成片报告与主案例不一致');
  }
  if (!Array.isArray(report.chapters) || !Array.isArray(filmPackage.beats)) {
    throw new Error('成片缺少章节或脚本');
  }
  const primary = verifiedPackage(id, filmPackage);
  const beats = new Map();
  for (const beat of filmPackage.beats) {
    if (typeof beat?.id !== 'string' || !beat.id || beats.has(beat.id)) throw new Error('脚本章节 ID 缺失或重复');
    beats.set(beat.id, beat);
  }
  const cache = new Map();
  async function loadCase(file) {
    if (!cache.has(file)) {
      cache.set(file, (async () => {
        const bindings = (report.additionalCases ?? []).filter(item => item.file === file);
        if (!bindings.length || bindings.some(item => !isHash(item.sha256) || !isHash(item.traceHash))) {
          throw new Error('反例缺少成片报告中的文件与轨迹绑定');
        }
        const bytes = await readCase(file);
        if (!Buffer.isBuffer(bytes)) throw new Error('readCase 必须返回原始 Buffer');
        const digest = sha256(bytes);
        if (bindings.some(item => item.sha256 !== digest)) throw new Error('反例文件 SHA-256 与成片报告不一致');
        const data = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
        const verified = verifiedPackage(id, data);
        if (bindings.some(item => item.traceHash !== verified.traceHash)) throw new Error('反例 traceHash 与成片报告不一致');
        return verified;
      })());
    }
    return cache.get(file);
  }
  const result = [];
  for (const chapter of report.chapters) {
    const beat = beats.get(chapter.id);
    if (!beat) throw new Error('成片章节在当前脚本中不存在：' + chapter.id);
    const entry = {title: chapter.title, start: chapter.start};
    const hasCase = beat.caseFile !== undefined;
    const file = hasCase ? caseBasename(beat.caseFile) : undefined;
    if (chapter.caseFile !== undefined && chapter.caseFile !== file) throw new Error('成片章节与脚本的反例文件不一致');
    const references = hasCase ? beat.caseEventIds : chapter.eventIds;
    if (references !== undefined && !Array.isArray(references)) throw new Error('章节事件列表必须是数组');
    if (!references?.length) { result.push(entry); continue; }
    const key = eventId(references[0]);
    const source = hasCase ? await loadCase(file) : primary;
    if (!source.ids.has(key)) throw new Error('章节引用未知事件：' + key);
    result.push({...entry, eventId: key, teachingCase: structuredClone(source.teachingCase),
      caseTraceHash: source.traceHash, ...(hasCase ? {caseFile: file} : {})});
  }
  return result;
}
