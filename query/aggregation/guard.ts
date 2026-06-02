import type { Trajectory } from '../../interfaces/trajectory';

export type AggregatableTrajectory = Trajectory & {
  attributes: {
    road_id: string;
    distance: number;
    durtime: number;
  };
};

export const isAggregatableTrajectory = (
  trajectory: Trajectory
): trajectory is AggregatableTrajectory =>
  trajectory.attributes?.road_id !== undefined &&
  trajectory.attributes?.distance !== undefined &&
  trajectory.attributes?.durtime !== undefined;
