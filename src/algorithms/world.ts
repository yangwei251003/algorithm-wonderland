import type {Runner} from '../engine/types';
import {visionRunners} from './world-vision';
import {controlRunners} from './world-control';
import {decisionRunners} from './world-decision';
import {generativeRunners} from './world-generative';
export const runners:Record<string,Runner>={...visionRunners,...controlRunners,...decisionRunners,...generativeRunners};
