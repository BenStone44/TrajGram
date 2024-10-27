import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import { LensSVG } from '../selection/lens_svg';
import { Query, type filterFunc } from './query';

export const parseCondition = (
  condition: Array<string> | string,
  query: Query,
  core: Trajectoolkit
): filterFunc[] => {
  if (Array.isArray(condition)) {
    const TKT = core;
    const conditionFunctions: Array<(element: Trajectory) => boolean> = [];
    condition.map((perCondition) => {
      const selectionCondition = TKT.getSelectionByID(perCondition);
      const comp = selectionCondition?.component;
      if (selectionCondition && comp) {
        if (comp instanceof LensSVG) {
          selectionCondition.children.push(query);
          conditionFunctions.push(
            (element: Trajectory | Trajectorypoint) =>
              comp.match(element, 'trajectory') as boolean
          );
        }
      } else {
        conditionFunctions.push(
          parseConditionTstring(perCondition, 'trajectory')
        );
      }
    });

    return conditionFunctions;
  } else {
    return [];
  }
};


const parseCompareCondition = (condition: string) => {
  // 移除所有空格
  condition = condition.replace(/\s+/g, '');
  
  // 使用正则表达式匹配
  const match = condition.match(/([a-zA-Z]+\(\$[A-Z]\))([<>=]+)(\d+)/);
  
  if (!match) {
    throw new Error(`Invalid condition format: ${condition}`);
  }
  
  const [_, attribute, operator, threshold] = match;
  
  return {
    attribute,
    operator,
    threshold: Number(threshold)
  };
};



export const parseConditionTstring = (
  Tcondition: string,
  elementType: 'point' | 'trajectory'
): filterFunc => {
  console.log(Tcondition)
  const {attribute, operator, threshold} = parseCompareCondition(Tcondition);
  if (elementType == 'trajectory' && attribute == 'distance($T)') {
    switch (operator) {
      case '<':
        return (element: Trajectory) =>
          (element as Trajectory).distance < threshold;
      case '>':
        return (element: Trajectory) =>
          (element as Trajectory).distance > threshold;
      case '<=':
        return (element: Trajectory) =>
          (element as Trajectory).distance <= threshold;
      case '>=':
        return (element: Trajectory) =>
          (element as Trajectory).distance >= threshold;
      case '==':
        return (element: Trajectory) =>
          (element as Trajectory).distance === threshold;
      default:
        return (element: Trajectory) => false;
    }
  }
  //else return (element: Trajectory) => false;
  else if (elementType == 'trajectory') {
    switch (Tcondition) {
      case 'weekday':
        return (element: Trajectory) => queryDayArray(element, 1, 6) as boolean;
      case 'weekend':
        return (element: Trajectory) => queryDayArray(element, 6, 0) as boolean;
      case 'morning':
        return (element: Trajectory) =>
          queryHourArray(element, 6, 10) as boolean;
      case 'afternoon':
        return (element: Trajectory) =>
          queryHourArray(element, 16, 20) as boolean;
      default:
        return (element: Trajectory) =>
          queryTimeArray(element, Tcondition) as boolean;
    }
  }
  else return (element: Trajectory) => false;
};
export const queryDayArray = (
  element: Trajectory,
  startDay: number,
  endDay: number
): boolean => {
  const time = (element as Trajectory).shapingPoints[0].basePoint.time;

  if (time) {
    const date = new Date(time);
    const dayOfWeek = date.getDay();
    if (endDay < startDay) {
      return dayOfWeek == 0 || dayOfWeek == 6;
    } else return dayOfWeek >= startDay && dayOfWeek < endDay;
  } else {
    return false;
  }
};
export const queryHourArray = (
  element: Trajectory,
  startHour: number,
  endHour: number
): boolean => {
  const time = (element as Trajectory).shapingPoints[0].basePoint.time;
  if (time) {
    const timeString = parseTimeString(time);
    return timeString.hour >= startHour && timeString.hour < endHour;
  } else {
    return false;
  }
};
export const queryTimeArray = (
  element: Trajectory,
  Tcondition: string
): boolean => {
  const timeArray = Tcondition.substring(1, Tcondition.length - 1).split(',');
  const time = (element as Trajectory).shapingPoints[0].basePoint.time;
  if (time) {
    const timeDate = new Date(time);
    const startDate = new Date(timeArray[0]);
    const endDate = new Date(timeArray[1]);
    return timeDate >= startDate && timeDate < endDate;
  } else {
    return false;
  }
};
export const parseTimeString = (
  timeStr: string
): { year: number; month: number; day: number; hour: number } => {
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date string');
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  return { year, month, day, hour };
};
