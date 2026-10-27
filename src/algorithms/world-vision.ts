import type {Runner} from '../engine/types';
import {gaussianFilter,medianFilter,sobel,otsu} from './world-pixel';
import {ransac} from './world-ransac';
import {fft} from './world-spectrum';
import {seamCarving} from './world-seam';
export {fftCompute} from './world-spectrum';
export {removeSeam} from './world-seam';
export const visionRunners:Record<string,Runner>={'gaussian-filter':gaussianFilter,'median-filter':medianFilter,sobel,otsu,ransac,fft,'seam-carving':seamCarving};
