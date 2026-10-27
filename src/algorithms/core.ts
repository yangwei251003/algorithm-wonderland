import type {Runner} from '../engine/types';
import {searchRunners} from './core-search';
import {graphRunners} from './core-graph';
import {allocationRunners} from './core-allocation';
import {optimizationRunners} from './core-optimization';
export const runners:Record<string,Runner>={...searchRunners,...graphRunners,...allocationRunners,...optimizationRunners};
