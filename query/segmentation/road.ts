import type { Trajectory, Trajectorypoint } from '../../interfaces/trajectory';
import { calculateDistance, calculateDurTime } from '../../utils/utils_calculation';

type RoadSegmentTrajectory = Trajectory & {
  attributes: {
    road_id: string;
    durtime: number;
    distance: number;
  };
};

const buildRoadSegmentTrajectory = (
  trajectory: Trajectory,
  shapingPoints: Trajectorypoint[],
  roadId: string,
  index: number
): RoadSegmentTrajectory | null => {
  if (shapingPoints.length <= 1) {
    return null;
  }

  const starttime = shapingPoints[0].basePoint.time;
  const endtime = shapingPoints[shapingPoints.length - 1].basePoint.time;
  if (!(starttime && endtime)) {
    return null;
  }

  const distance = calculateDistance(shapingPoints);
  const durtime = calculateDurTime(starttime, endtime);

  return {
    id: trajectory.id + '#' + index,
    starttime,
    endtime,
    distance,
    shapingPoints,
    attributes: {
      road_id: roadId,
      durtime,
      distance
    }
  };
};

export const segmentTrajectoriesByRoadID = async (
  source: () => Promise<Trajectory[]>
): Promise<Trajectory[]> => {
  const data = await source();
  const trajectoriesWithSameRoadID: Trajectory[] = [];

  data.forEach((trajectory) => {
    const shapingPoints = trajectory.shapingPoints;
    const firstPointSource = shapingPoints[0]?.attributes.source;
    if (!firstPointSource) {
      return;
    }

    let previousSegmentId = firstPointSource.sid ?? '';
    let currentShapingPoints: Trajectorypoint[] = [];
    let index = 0;

    shapingPoints.forEach((point) => {
      const segmentId = point.attributes.source?.sid ?? '';
      if (!(segmentId && previousSegmentId)) {
        return;
      }

      if (segmentId === previousSegmentId) {
        currentShapingPoints.push(point);
        return;
      }

      const segmented = buildRoadSegmentTrajectory(
        trajectory,
        [...currentShapingPoints, point],
        previousSegmentId,
        index
      );
      if (segmented) {
        trajectoriesWithSameRoadID.push(segmented);
        index += 1;
      }

      previousSegmentId = segmentId;
      currentShapingPoints = [point];
    });
  });

  return trajectoriesWithSameRoadID;
};
