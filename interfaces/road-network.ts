import type { Trajectorypoint } from './trajectory';
export interface RoadNetworkAttributes {
  volume?: number;
  speed?: number; //roadnetwork.distance，not tra.true-distance
}
export type RoadNetworkItem = {
  id: string;
  distance: number;
  shapingPoints: Trajectorypoint[];
  attributes?: RoadNetworkAttributes;
}
