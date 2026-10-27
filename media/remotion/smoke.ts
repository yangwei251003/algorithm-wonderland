// Technical capability probe only. Formal lessons use the shared project trace.
export type SmokeInput = {origin: number; goal: number; walls: number[]};
export type SmokeEvent = {index: number; current: number; reached: number[]; queue: number[]; distances: number[]; path: number[]; message: string};
export const GRID = 5;
export function runSmokeBfs({origin, goal, walls}: SmokeInput) {
  const blocked = new Set(walls.filter(n => n !== origin && n !== goal));
  const distances = Array<number>(GRID * GRID).fill(-1);
  const parents = Array<number>(GRID * GRID).fill(-1);
  const queue = [origin];
  const reached = [origin];
  const events: SmokeEvent[] = [];
  distances[origin] = 0;
  const capture = (current: number, message: string, path: number[] = []) => events.push({index: events.length, current, reached: [...reached], queue: [...queue], distances: [...distances], path: [...path], message});
  capture(origin, '初始化：起点进入先进先出队列，距离记为 0。');
  while (queue.length) {
    const current = queue.shift()!;
    capture(current, `取队首 ${current}，已走 ${distances[current]} 步。`);
    if (current === goal) break;
    const x = current % GRID, y = Math.floor(current / GRID);
    for (const [name, dx, dy] of [['右',1,0], ['下',0,1], ['左',-1,0], ['上',0,-1]] as const) {
      const nx = x + dx, ny = y + dy, next = ny * GRID + nx;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) capture(current, `检查${name}侧：越界，跳过。`);
      else if (blocked.has(next)) capture(current, `检查 ${next}：障碍，不可通行。`);
      else if (distances[next] >= 0) capture(current, `检查 ${next}：已发现，保留首次距离 ${distances[next]}。`);
      else {
        distances[next] = distances[current] + 1;
        parents[next] = current;
        queue.push(next); reached.push(next);
        capture(current, `${next} 入队：距离 ${distances[current]} + 1 = ${distances[next]}。`);
      }
    }
  }
  const path: number[] = [];
  if (distances[goal] >= 0) {
    let at = goal;
    while (at >= 0) { path.unshift(at); capture(at, `沿父节点回溯：${at}。`, path); at = parents[at]; }
  }
  capture(goal, path.length ? `计算结束：最少 ${path.length - 1} 步。` : '候选队列已空，终点不可达。', path);
  return {events, path, distance: distances[goal], signature: JSON.stringify([origin, goal, [...blocked].sort((a,b)=>a-b), path])};
}
