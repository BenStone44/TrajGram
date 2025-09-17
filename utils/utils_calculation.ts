import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import * as turf from '@turf/turf';
const calculateSecondsBetweenDates = (
  dateString1: string,
  dateString2: string
) => {
  // 解析日期字符串为Date对象
  const date1 = new Date(dateString1);
  const date2 = new Date(dateString2);

  // 计算两个日期之间的差异（毫秒）
  const millisecondsDifference = date2.getTime() - date1.getTime();

  // 将毫秒转换为秒
  const secondsDifference = millisecondsDifference / 1000;

  // 返回秒数差
  return Math.abs(secondsDifference);
};

export const time = (T: Trajectory) => {
  return (
    Math.round(calculateSecondsBetweenDates(T.starttime, T.endtime) * 100) / 100
  );
};

export const speed = (T: Trajectory) => {
  return Math.round((T.distance * 100) / time(T)) / 100;
};
export const calculateDistance = (points: Trajectorypoint[]) => {
  let totalDistance = 0;
  let prePoint = turf.point([
    points[0].basePoint.position.lng,
    points[0].basePoint.position.lat
  ]);
  points.forEach((point: Trajectorypoint) => {
    const currentPoint = turf.point([
      point.basePoint.position.lng,
      point.basePoint.position.lat
    ]);
    const dis = turf.distance(prePoint, currentPoint, { units: 'kilometers' });
    totalDistance += dis;
    prePoint = currentPoint;
  });
  return totalDistance;
};
export const calculateDurTime = (starttime: string, endtime: string) => {
  const startDate = new Date(starttime);
  const endDate = new Date(endtime);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date strings');
  }

  const timeDifferenceInMilliseconds = endDate.getTime() - startDate.getTime();

  const timeDifferenceInSeconds = Math.round(
    timeDifferenceInMilliseconds / 1000
  );

  return timeDifferenceInSeconds;
};
