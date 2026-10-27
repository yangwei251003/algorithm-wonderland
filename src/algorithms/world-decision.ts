import type {Runner} from '../engine/types';
import {minimax,mcts} from './world-game';
import {ahp,topsis} from './world-ranking';
import {bandit,regret} from './world-bandit';
export {winner,minimaxValue} from './world-game';
export {topsisScores} from './world-ranking';
export const decisionRunners:Record<string,Runner>={minimax,mcts,ucb:bandit('ucb'),thompson:bandit('thompson'),ahp,topsis,regret};
