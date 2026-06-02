import type { RoadNetworkItem } from '../../interfaces/road-network';
import type { Trajectory } from '../../interfaces/trajectory';
import type { Trajectoolkit } from '../../Trajectoolkit';
import type { AggregatableTrajectory } from './guard';
import { isAggregatableTrajectory } from './guard';

type AggregatedRoadStageItem = {
  id: string;
  attributes: {
    volume: number;
    distance: number;
    durtime: number;
  };
};

type VolumeDistributionItem = {
  volume: number;
  value: number;
};

const accumulateRoadStageItem = (
  stageItems: AggregatedRoadStageItem[],
  trajectory: AggregatableTrajectory
) => {
  const existing = stageItems.find(
    (item) => item.id === trajectory.attributes.road_id
  );
  if (existing) {
    existing.attributes.volume += 1;
    existing.attributes.distance += trajectory.attributes.distance;
    existing.attributes.durtime += trajectory.attributes.durtime;
    return;
  }

  stageItems.push({
    id: trajectory.attributes.road_id,
    attributes: {
      volume: 1,
      distance: trajectory.attributes.distance,
      durtime: trajectory.attributes.durtime
    }
  });
};

const updateVolumeDistribution = (
  volumeDistribute: VolumeDistributionItem[],
  volume: number
) => {
  const distribution = volumeDistribute.find((entry) => entry.volume === volume);
  if (distribution) {
    distribution.value += 1;
  } else {
    volumeDistribute.push({ volume, value: 1 });
  }
};

export const aggregateTrajectoriesByRoadID = async (
  source: () => Promise<Trajectory[]>,
  core: Trajectoolkit
): Promise<RoadNetworkItem[]> => {
  const data = await source();
  const stageNewRoadnetwork: AggregatedRoadStageItem[] = [];
  const formedNewRoadnetwork: RoadNetworkItem[] = [];
  const roadnetworkData = (await core.getDQSDatabyID('roadnetwork')) as RoadNetworkItem[];

  data.forEach((trajectory) => {
    if (!isAggregatableTrajectory(trajectory)) {
      return;
    }
    accumulateRoadStageItem(stageNewRoadnetwork, trajectory);
  });

  const volumeDistribute: VolumeDistributionItem[] = [];
  stageNewRoadnetwork.forEach((item) => {
    updateVolumeDistribution(volumeDistribute, item.attributes.volume);

    const road = roadnetworkData.find((entry) => entry.id === item.id);
    if (!road) {
      return;
    }

    const speed =
      item.attributes.durtime === 0
        ? 0
        : (item.attributes.volume * road.distance) / item.attributes.durtime;

    formedNewRoadnetwork.push({
      id: item.id,
      distance: road.distance,
      shapingPoints: road.shapingPoints,
      attributes: {
        volume: item.attributes.volume,
        speed
      }
    });
  });

  volumeDistribute.sort((a, b) => a.volume - b.volume);
  console.log('volumeDistribute', volumeDistribute);
  return formedNewRoadnetwork;
};
