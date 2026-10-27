import type {Runner} from '../engine/types';
import {sha256Teaching} from './intelligence-sha256';
import {retrievalRunners} from './intelligence-retrieval';
import {compressionRunners} from './intelligence-compression';
export {rleEncode,rleDecode,huffmanEncode,huffmanDecode,lzEncode,lzDecode,hammingEncode,hammingCorrect,crcRemainder} from './intelligence-compression';
export type {LZToken} from './intelligence-compression';
export const informationRunners:Record<string,Runner>={...retrievalRunners,...compressionRunners,sha256:sha256Teaching};
