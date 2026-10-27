import type {Runner} from '../engine/types';
import {dataset} from './intelligence-data';
import {createKmeans} from './intelligence-clustering';
import {informationRunners} from './intelligence-information';
import {movingAverage,exponentialSmoothing,linearRegression,bayes,monteCarlo,bootstrap,fitLine} from './intelligence-prediction';
import {logisticRegression,knn,decisionTree,naiveBayes,dbscan,pca,neuralNetwork} from './intelligence-models';
export {movingAverage,exponentialSmoothing,linearRegression,bayes,monteCarlo,bootstrap,fitLine,logisticRegression,knn,decisionTree,naiveBayes,dbscan,pca,neuralNetwork};
export const kmeans:Runner=createKmeans(dataset);
export const runners:Record<string,Runner>={
 'moving-average':movingAverage,'exponential-smoothing':exponentialSmoothing,
 'linear-regression':linearRegression,'logistic-regression':logisticRegression,
 bayes,'monte-carlo':monteCarlo,bootstrap,knn,'decision-tree':decisionTree,
 'naive-bayes':naiveBayes,kmeans,dbscan,pca,'neural-network':neuralNetwork,...informationRunners,
};
