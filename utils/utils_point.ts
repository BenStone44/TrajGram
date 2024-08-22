import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import mapboxgl, { LngLat } from 'mapbox-gl';
import { TimeCalculate } from './utils_time';
import { getPixelLength } from './utils_scale';
import type { Point, Feature, LineString, GeoJsonProperties } from 'geojson';
import * as turf from '@turf/turf';
import lineIntersect from '@turf/line-intersect';
import pointToLineDistance from '@turf/point-to-line-distance';
import { computeUnitVector } from '../encoding/parse';
import { Trajectoolkit } from '../Trajectoolkit';
import _ from 'lodash';

const getMiddleLngLat = (r: number, p1: LngLat, p2: LngLat): LngLat => {
  return {
    lng: p1.lng * (1 - r) + p2.lng * r,
    lat: p1.lat * (1 - r) + p2.lat * r
  } as LngLat;
};

export const getPointByTime = (
  trajectory: Trajectory,
  time: string,
  id: string
): Trajectorypoint => {
  const ps = trajectory.shapingPoints;
  let ratio = 0;
  let previous, after;
  for (let i = 0; i < ps.length - 1; i++) {
    previous = ps[i];
    after = ps[i + 1];
    const Tprevious = previous.basePoint.time;
    const Tafter = after.basePoint.time;
    if (!Tafter || !Tprevious) throw new Error("time info didn't exsit");
    ratio = TimeCalculate.isBetween(time, Tprevious, Tafter);
    if (ratio > 0) break;
  }
  if (!previous || !after) throw new Error('time not found');

  const baseInfo = {
    id,
    basePoint: {
      time,
      position: getMiddleLngLat(
        ratio,
        previous.basePoint.position,
        after.basePoint.position
      )
    },
    attributes: {
      source: {
        tid: trajectory.id
      },
      others: previous.attributes.others
    }
  } as Trajectorypoint;

  const previousComputedInfo = previous.attributes.computed;
  const afterComputedInfo = after.attributes.computed;
  if (previousComputedInfo && afterComputedInfo) {
    baseInfo.attributes.computed = {};
    if (
      previousComputedInfo.trajDP != undefined &&
      afterComputedInfo.trajDP != undefined
    ) {
      baseInfo.attributes.computed.trajDP =
        previousComputedInfo.trajDP * (1 - ratio) +
        afterComputedInfo.trajDP * ratio;
    }
    if (
      previousComputedInfo.trajTP != undefined &&
      afterComputedInfo.trajTP != undefined
    ) {
      baseInfo.attributes.computed.trajTP =
        TimeCalculate.differ(time, trajectory.starttime) /
        TimeCalculate.differ(trajectory.endtime, trajectory.starttime);
    }
  }

  return baseInfo;
};

export const getPointByTimeRatio = (
  core: Trajectoolkit,
  trajectory: Trajectory,
  timeR: number,
  id: string
): Trajectorypoint => {
  const ps = trajectory.shapingPoints;
  let previous, after;
  for (let i = 0; i < ps.length - 1; i++) {
    previous = ps[i];
    after = ps[i + 1];
    const Tprevious = previous.attributes.computed?.trajTP;
    const Tafter = after.attributes.computed?.trajTP;
    if (Tafter == undefined || Tprevious == undefined)
      throw new Error("ratio info didn't exsit");
    if (timeR >= Tprevious && timeR <= Tafter) break;
  }
  if (previous == undefined || after == undefined) throw new Error('not found');
  const direction = computeUnitVector(
    previous.basePoint.position,
    after.basePoint.position,
    core
  );
  const time = TimeCalculate.addSecondsToDate(
    trajectory.starttime,
    TimeCalculate.differ(trajectory.endtime, trajectory.starttime) * timeR
  );

  if (
    previous.attributes.computed == undefined ||
    after.attributes.computed == undefined ||
    previous.attributes.computed.trajDP == undefined ||
    after.attributes.computed.trajDP == undefined ||
    previous.attributes.computed.trajTP == undefined ||
    after.attributes.computed.trajTP == undefined
  )
    throw new Error(" info didn't exsit");
  const ratio =
    after.attributes.computed.trajTP == previous.attributes.computed.trajTP
      ? 0.5
      : (timeR - previous.attributes.computed.trajTP) /
        (after.attributes.computed.trajTP -
          previous.attributes.computed.trajTP);

  const baseInfo = {
    id,
    basePoint: {
      time,
      position: getMiddleLngLat(
        ratio,
        previous.basePoint.position,
        after.basePoint.position
      )
    },
    attributes: {
      source: {
        tid: trajectory.id
      },
      computed: {
        trajDP:
          previous.attributes.computed.trajDP * (1 - ratio) +
          after.attributes.computed.trajDP * ratio,
        trajTP:
          TimeCalculate.differ(time, trajectory.starttime) /
          TimeCalculate.differ(trajectory.endtime, time),
        direction: direction
      },
      others: previous.attributes.others
    }
  } as Trajectorypoint;

  return baseInfo;
};

export const getPointByDistance = (
  core: Trajectoolkit,
  trajectory: Trajectory,
  distance: number,
  id: string
): Trajectorypoint => {
  const ps = trajectory.shapingPoints;
  let ratio = 0;
  let previous, after;
  const distanceT = trajectory.distance;
  for (let i = 0; i < ps.length - 1; i++) {
    previous = ps[i];
    after = ps[i + 1];

    const Tprevious = previous.attributes.computed?.trajDP;
    const Tafter = after.attributes.computed?.trajDP;
    if (!Tafter || !Tprevious) throw new Error("time info didn't exsit");
    const distanceR = distance / distanceT;
    ratio = (distanceR - Tprevious) / (Tafter - Tprevious);
    if (distanceR >= Tprevious && distanceR <= Tafter) break;
  }
  if (!previous || !after) throw new Error('time not found');
  const direction = computeUnitVector(
    previous.basePoint.position,
    after.basePoint.position,
    core
  );
  if (
    previous.attributes.computed == undefined ||
    after.attributes.computed == undefined ||
    previous.attributes.computed.trajDP == undefined ||
    after.attributes.computed.trajDP == undefined
    // !previous.attributes.computed.trajTP ||
    // !after.attributes.computed.trajTP
  )
    throw new Error(" info didn't exsit");

  const baseInfo = {
    id,
    basePoint: {
      position: getMiddleLngLat(
        ratio,
        previous.basePoint.position,
        after.basePoint.position
      )
    },
    attributes: {
      source: {
        tid: trajectory.id
      },
      computed: {
        trajDP:
          previous.attributes.computed.trajDP * (1 - ratio) +
          after.attributes.computed.trajDP * ratio,
        direction: direction
      }
    }
  } as Trajectorypoint;

  if (previous.basePoint.time && after.basePoint.time) {
    const trange = TimeCalculate.differ(
      after.basePoint.time,
      previous.basePoint.time
    );
    const time = TimeCalculate.addSecondsToDate(
      previous.basePoint.time,
      trange * ratio
    );
    baseInfo.basePoint = {
      position: getMiddleLngLat(
        ratio,
        previous.basePoint.position,
        after.basePoint.position
      ),
      time: time
    };

    if (
      previous.attributes.computed.trajTP != undefined &&
      after.attributes.computed.trajTP != undefined
    ) {
      baseInfo.attributes = {
        source: {
          tid: trajectory.id
        },
        computed: {
          direction: direction,
          trajDP:
            previous.attributes.computed.trajDP * (1 - ratio) +
            after.attributes.computed.trajDP * ratio,
          trajTP:
            TimeCalculate.differ(time, trajectory.starttime) /
            TimeCalculate.differ(trajectory.endtime, trajectory.starttime)
        }
      };
    }
  }

  return baseInfo;
};

export const getPointByDistanceR = (
  core: Trajectoolkit,
  trajectory: Trajectory,
  distanceR: number,
  id: string
): Trajectorypoint => {
  const ps = trajectory.shapingPoints;
  let ratio = 0;
  let previous, after;
  for (let i = 0; i < ps.length - 1; i++) {
    previous = ps[i];
    after = ps[i + 1];

    const Tprevious = previous.attributes.computed?.trajDP;
    const Tafter = after.attributes.computed?.trajDP;
    if (Tafter == undefined || Tprevious == undefined)
      throw new Error("time info didn't exsit");

    ratio = (distanceR - Tprevious) / (Tafter - Tprevious);
    if (distanceR >= Tprevious && distanceR <= Tafter) break;
  }
  if (previous == undefined || after == undefined)
    throw new Error('point not found');
  const direction = computeUnitVector(
    previous.basePoint.position,
    after.basePoint.position,
    core
  );
  if (
    previous.attributes.computed == undefined ||
    after.attributes.computed == undefined ||
    previous.attributes.computed.trajDP == undefined ||
    after.attributes.computed.trajDP == undefined
    // !previous.attributes.computed.trajTP ||
    // !after.attributes.computed.trajTP
  )
    throw new Error("info didn't exsit");

  const baseInfo = {
    id,
    basePoint: {
      position: getMiddleLngLat(
        ratio,
        previous.basePoint.position,
        after.basePoint.position
      )
    },
    attributes: {
      source: {
        tid: trajectory.id
      },
      computed: {
        trajDP:
          previous.attributes.computed.trajDP * (1 - ratio) +
          after.attributes.computed.trajDP * ratio,
        direction: direction
      },
      others: previous.attributes.others
    }
  } as Trajectorypoint;

  if (previous.basePoint.time && after.basePoint.time) {
    const trange = TimeCalculate.differ(
      after.basePoint.time,
      previous.basePoint.time
    );
    const time = TimeCalculate.addSecondsToDate(
      previous.basePoint.time,
      trange * ratio
    );
    baseInfo.basePoint = {
      position: getMiddleLngLat(
        ratio,
        previous.basePoint.position,
        after.basePoint.position
      ),
      time: time
    };

    if (
      previous.attributes.computed.trajTP != undefined &&
      after.attributes.computed.trajTP != undefined
    ) {
      baseInfo.attributes = {
        source: {
          tid: trajectory.id
        },
        computed: {
          trajDP:
            previous.attributes.computed.trajDP * (1 - ratio) +
            after.attributes.computed.trajDP * ratio,
          trajTP:
            TimeCalculate.differ(time, trajectory.starttime) /
            TimeCalculate.differ(trajectory.endtime, trajectory.starttime),
          direction: direction
        },
        others: previous.attributes.others
      };
    }
  }

  return baseInfo;
};

export const findCircleLineIntersections = (
  map: mapboxgl.Map,
  center: LngLat,
  radius: number,
  path: LngLat[]
) => {
  // 创建一个圆形
  const point = turf.point([center.lng, center.lat]);
  const circle = turf.circle(
    point,
    getPixelLength(map, radius),
    undefined,
    'kilometers'
  );

  // 创建轨迹的线
  const line = turf.lineString(path.map((p) => [p.lng, p.lat]));

  // 计算交点
  const intersects = lineIntersect(circle, line);

  // 返回交点的坐标数组

  return intersects.features.map((pt: any) => pt.geometry.coordinates);
};

type IntersectionResult = {
  point: LngLat;
  index: number;
  ratio: number;
};

export function findIntersections(
  trajectory: Trajectory,
  center: LngLat,
  radius: number
): Trajectorypoint[] {
  const path = trajectory.shapingPoints.map((p) => p.basePoint.position);
  // 将路径转换为Turf LineString
  const pathLineString = turf.lineString(path.map((p) => [p.lng, p.lat]));
  // 创建Turf Circle
  const p = turf.point([center.lng, center.lat]);
  const circlePolygon = turf.circle(p, radius, undefined, 'kilometers');

  // 使用Turf寻找交点
  const intersects = lineIntersect(pathLineString, circlePolygon);

  // 如果没有交点，则返回空数组
  if (!intersects.features.length) {
    return [];
  }

  // 存储交点信息数组
  const intersections: IntersectionResult[] = [];

  // 遍历交点
  intersects.features.forEach((intersect: any) => {
    if (intersect.geometry && intersect.geometry.type === 'Point') {
      const [lng, lat] = intersect.geometry.coordinates;
      // 对于每个交点，找到它所在的线段
      for (let i = 0; i < path.length - 1; i++) {
        const segment = [path[i], path[i + 1]] as [LngLat, LngLat];
        const segmentLineString = turf.lineString(
          [segment[0], segment[1]].map((p) => [p.lng, p.lat])
        );
        // 检查交点是否在这个线段上
        if (pointIsOnLine(intersect, segmentLineString)) {
          // 交点在该线段上，计算比例
          const distanceToStart = turf.distance(
            turf.point([segment[0].lng, segment[0].lat]),
            intersect,
            'kilometers'
          );
          const segmentLength = turf.distance(
            turf.point([segment[0].lng, segment[0].lat]),
            turf.point([segment[1].lng, segment[1].lat]),
            'kilometers'
          );
          const ratio = distanceToStart / segmentLength;
          // 将交点信息添加到数组中
          intersections.push({
            point: { lng, lat } as LngLat,
            index: i,
            ratio: ratio
          });
          break; // 退出循环，因为交点不会在两个线段上
        }
      }
    }
  });

  return intersections.map((intersection, index) =>
    getPointBySegmentAndRatio(
      trajectory,
      intersection.index,
      intersection.ratio,
      'w' + index
    )
  );
}

export function getPointBySegmentAndRatio(
  trajectory: Trajectory,
  index: number,
  ratio: number,
  id: string
) {
  const ps = trajectory.shapingPoints;
  const previous = ps[index];
  const after = ps[index + 1];
  if (!previous || !after) throw new Error('not found');
  if (
    previous.attributes.computed == undefined ||
    after.attributes.computed == undefined ||
    previous.attributes.computed.trajDP == undefined ||
    after.attributes.computed.trajDP == undefined
    // !previous.attributes.computed.trajTP ||
    // !after.attributes.computed.trajTP
  )
    throw new Error(" info didn't exsit");

  const baseInfo = {
    id,
    basePoint: {
      position: getMiddleLngLat(
        ratio,
        previous.basePoint.position,
        after.basePoint.position
      )
    },
    attributes: {
      source: {
        tid: trajectory.id
      },
      computed: {
        trajDP:
          previous.attributes.computed.trajDP * (1 - ratio) +
          after.attributes.computed.trajDP * ratio
      },
      others: previous.attributes.others
    }
  } as Trajectorypoint;

  if (previous.basePoint.time && after.basePoint.time) {
    const trange = TimeCalculate.differ(
      after.basePoint.time,
      previous.basePoint.time
    );

    const time = TimeCalculate.addSecondsToDate(
      previous.basePoint.time,
      trange * ratio
    );

    baseInfo.basePoint = {
      position: getMiddleLngLat(
        ratio,
        previous.basePoint.position,
        after.basePoint.position
      ),
      time: time
    };

    if (
      previous.attributes.computed.trajTP != undefined &&
      after.attributes.computed.trajTP != undefined
    ) {
      baseInfo.attributes = {
        source: {
          tid: trajectory.id
        },
        computed: {
          trajDP:
            previous.attributes.computed.trajDP * (1 - ratio) +
            after.attributes.computed.trajDP * ratio,
          trajTP:
            TimeCalculate.differ(time, trajectory.starttime) /
            TimeCalculate.differ(trajectory.endtime, time)
        },
        others: previous.attributes.others
      };
    }
  }

  return baseInfo;
}

export function pointIsOnLine(
  point: Feature<Point, GeoJsonProperties>,
  line: Feature<LineString, GeoJsonProperties>
) {
  return pointToLineDistance(point, line) < 0.1;
}

export const generateSubTrajectory = (
  startpoint: Trajectorypoint,
  endpoint: Trajectorypoint,
  trajectory: Trajectory,
  id: string
) => {
  const subTrajectory: Trajectory = {
    id,
    starttime: startpoint.basePoint?.time || '',
    endtime: endpoint.basePoint?.time || '',
    distance: 0,
    shapingPoints: []
  };
  if (
    startpoint.attributes?.computed?.trajDP == undefined ||
    endpoint.attributes?.computed?.trajDP == undefined
  )
    throw new Error('wrong info');

  const distance =
    (endpoint.attributes.computed.trajDP -
      startpoint.attributes.computed.trajDP) *
    trajectory.distance;
  subTrajectory.distance = Math.round(distance);

  const sdp = startpoint.attributes.computed.trajDP;
  // const edp = endpoint.attributes.computed.trajDP;
  const shappingpoints = trajectory.shapingPoints;

  let i = 0;
  let newShappingpoints: Trajectorypoint[] = [];
  for (; i < shappingpoints.length; i++) {
    const point = shappingpoints[i];
    if (point.attributes?.computed?.trajDP == undefined)
      throw new Error('wrong info');
    if (point.attributes.computed.trajDP >= sdp) break;
  }
  newShappingpoints.push(startpoint);
  for (let j = i; j < shappingpoints.length; j++) {
    const point = shappingpoints[j];

    if (point.attributes?.computed?.trajDP == undefined)
      throw new Error('wrong info');
    if (point.attributes.computed.trajDP >= endpoint.attributes.computed.trajDP)
      break;
    newShappingpoints.push(point);
  }
  newShappingpoints.push(endpoint);

  newShappingpoints = removeDuplicates(newShappingpoints);

  newShappingpoints = newShappingpoints.map((p) => {
    let newp = _.cloneDeep(p);
    if (
      newp.attributes.computed?.trajDP != undefined &&
      startpoint.attributes.computed?.trajDP != undefined &&
      endpoint.attributes.computed?.trajDP != undefined
    ) {
      newp.attributes.computed.trajDP =
        (newp.attributes.computed.trajDP -
          startpoint.attributes.computed.trajDP) /
        (endpoint.attributes.computed.trajDP -
          startpoint.attributes.computed.trajDP);
    }
    return newp;
  });
  subTrajectory.shapingPoints = newShappingpoints;
  return subTrajectory;
};

function removeDuplicates(array: Trajectorypoint[]) {
  const seen = new Set();
  return array.filter((point) => {
    const dp = point.attributes.computed?.trajDP;
    if (dp == undefined) return true;
    const duplicate = seen.has(dp);
    if (!duplicate) {
      seen.add(dp);
      return true;
    }
    return false;
  });
}

export const splitTrajectory = (
  trajectory: Trajectory,
  ps: Trajectorypoint[]
) => {
  const subs: Trajectory[] = [];
  const psse: Trajectorypoint[] = [];
  psse.push(trajectory.shapingPoints[0]);
  ps.map((p) => psse.push(p));
  psse.push(trajectory.shapingPoints[trajectory.shapingPoints.length - 1]);

  const newPs = removeDuplicates(psse);

  for (let i = 0; i < newPs.length - 1; i++) {
    subs.push(
      generateSubTrajectory(
        _.cloneDeep(newPs[i]),
        _.cloneDeep(newPs[i + 1]),
        _.cloneDeep(trajectory),
        'split' + i + trajectory.id
      )
    );
  }
  return subs;
};
