import type { Trajectory } from '../../interfaces/trajectory';
import type { Trajectoolkit } from '../../Trajectoolkit';
import {
  getPointByDistanceR,
  getPointByTimeRatio,
  splitTrajectory
} from '../../utils/utils_point';

export const evenSplitTrajectories = async (
  source: () => Promise<Trajectory[]>,
  core: Trajectoolkit,
  type: 'D' | 'T',
  segnum: number
): Promise<Trajectory[]> => {
  const ratios = Array.from(
    { length: segnum + 1 },
    (_, index) => index / segnum
  );
  const data = await source();

  return data.flatMap((trajectory, index) =>
    splitTrajectory(
      trajectory,
      ratios.map((ratio) =>
        type === 'D'
          ? getPointByDistanceR(core, trajectory, ratio, trajectory.id + index)
          : getPointByTimeRatio(core, trajectory, ratio, trajectory.id + index)
      )
    )
  );
};
