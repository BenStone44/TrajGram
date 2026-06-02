import { Trajectoolkit } from '../../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../../interfaces/trajectory';
import { LensSVG } from '../../selection/lens_svg';
import type { Query } from '../query';
import type { FilterCondition, QueryPredicate } from '../types';

export const parseFilterCondition = (
  condition: FilterCondition,
  query: Query,
  core: Trajectoolkit
): QueryPredicate[] => {
  if (!Array.isArray(condition)) {
    return [];
  }

  const conditionFunctions: QueryPredicate[] = [];
  condition.forEach((perCondition) => {
    const selectionCondition = core.getSelectionByID(perCondition);
    const component = selectionCondition?.component;

    if (selectionCondition && component instanceof LensSVG) {
      selectionCondition.children.push(query);
      conditionFunctions.push((element: Trajectory | Trajectorypoint) =>
        component.match(element, 'trajectory')
      );
      return;
    }

    conditionFunctions.push(parseFilterConditionString(perCondition, 'trajectory'));
  });

  return conditionFunctions;
};

export const parseFilterConditionString = (
  condition: string,
  elementType: 'point' | 'trajectory'
): QueryPredicate => {
  const normalizedCondition = condition.replace(/\s+/g, '');
  if (elementType !== 'trajectory') {
    throw new Error('Invalid parseFilterConditionString!');
  }

  const compareMatch = normalizedCondition.match(
    /^distance\(\$T\)([<>=]+)(\d+)$/
  );
  if (compareMatch) {
    const [, operator, thresholdText] = compareMatch;
    const threshold = Number(thresholdText);
    switch (operator) {
      case '<':
        return (element) => element.distance < threshold;
      case '>':
        return (element) => element.distance > threshold;
      case '<=':
        return (element) => element.distance <= threshold;
      case '>=':
        return (element) => element.distance >= threshold;
      case '==':
        return (element) => element.distance === threshold;
      default:
        throw new Error('Invalid parseFilterConditionString!');
    }
  }

  switch (condition) {
    case 'weekday':
      return (element) => queryDayArray(element, 1, 6);
    case 'weekend':
      return (element) => queryDayArray(element, 6, 0);
    case 'morning':
      return (element) => queryHourArray(element, 6, 10);
    case 'afternoon':
      return (element) => queryHourArray(element, 16, 20);
    default:
      return (element) => queryTimeArray(element, normalizedCondition);
  }
};

const queryDayArray = (
  element: Trajectory,
  startDay: number,
  endDay: number
): boolean => {
  const time = element.shapingPoints[0].basePoint.time;
  if (!time) {
    return false;
  }

  const date = new Date(time);
  const dayOfWeek = date.getDay();
  if (endDay < startDay) {
    return dayOfWeek === 0 || dayOfWeek === 6;
  }
  return dayOfWeek >= startDay && dayOfWeek < endDay;
};

const queryHourArray = (
  element: Trajectory,
  startHour: number,
  endHour: number
): boolean => {
  const time = element.shapingPoints[0].basePoint.time;
  if (!time) {
    return false;
  }

  const hour = parseTimeString(time).hour;
  return hour >= startHour && hour < endHour;
};

const queryTimeArray = (
  element: Trajectory,
  condition: string
): boolean => {
  const timeArray = condition.substring(1, condition.length - 1).split(',');
  const time = element.shapingPoints[0].basePoint.time;
  if (!time) {
    return false;
  }

  const timeDate = new Date(time);
  const startDate = new Date(timeArray[0]);
  const endDate = new Date(timeArray[1]);
  return timeDate >= startDate && timeDate < endDate;
};

const parseTimeString = (
  timeStr: string
): { year: number; month: number; day: number; hour: number } => {
  const date = new Date(timeStr);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date string');
  }

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours()
  };
};
