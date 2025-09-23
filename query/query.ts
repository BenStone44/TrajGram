import {
  getPointByDistanceR,
  getPointByTimeRatio,
  splitTrajectory
} from '../utils/utils_point';
import type { RoadNetworkItem } from '../interfaces/road-network';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import { type RelationTreeNode, Trajectoolkit } from '../Trajectoolkit';
import { parseCondition, parseOperator } from './parse';
import {
  calculateDistance,
  calculateDurTime
} from '../utils/utils_calculation';


export interface QuerySetting {
  id: string;
  source: string;
  type: 'filter' | 'segmentation' | 'aggregation';
  condition?: Array<string> | string;
  operator?: string;
  set?: any;
}

export type filterFunc = (elememt: Trajectory) => boolean;

export class Query {
  id: string;
  source: () => Trajectory[];
  type: string;
  match: (element: Trajectory) => boolean = () => false;
  condition = new Map<string, filterFunc>();
  callBack = new Map<string, () => any>();
  children: RelationTreeNode[] = [];
  core: Trajectoolkit;
  constructor(specification: QuerySetting, core: Trajectoolkit) {
    this.core = core;
    this.id = specification.id;
    this.source = () =>
      core.getDQSDatabyID(specification.source) as Trajectory[];
    core.getDQSbyID(specification.source)?.children.push(this);
    this.type = specification.type;
    //如果是filter，才会有condition
    if (this.type === 'filter' && specification.condition) {
      this.parseConditionToFunctions(specification.condition);
      this.updateMatch();
    } 
    else if (this.type === 'segmentation' && specification.operator) {
      if (specification.operator === 'road') {
        this.segmentationByRoadID();
      } 
      else {
        const parsed = parseOperator(specification.operator);
        if (parsed) {
            this.queryResult = () => this.evenSplit(parsed.type, parsed.count);
        }
      }
    } 
    else if (this.type === 'aggregation') {
      this.aggregationByRoadID();
    } 
    else {
      console.log('other type');
    }
  }

  public setSourceFunction(sourceFunc: () => Trajectory[]) {
    this.source = sourceFunc;
    this.update();
  }

  public evenSplit(type: string, segnum: number) {
    const Rs = Array.from({ length: segnum + 1 }, (_, index) => index / segnum);
    const subTrajectories = this.source().flatMap(
      (T: Trajectory, index: number) =>
        splitTrajectory(
          T,
          Rs.map((ratio) =>
            type == 'D'
              ? getPointByDistanceR(this.core, T, ratio, T.id + index)
              : getPointByTimeRatio(this.core, T, ratio, T.id + index)
          )
        )
    );
    return subTrajectories;
  }

  private updateMatch() {
    this.match = (element: Trajectory) => {
      for (const func of this.condition.values()) {
        if (!func(element)) {
          return false;
        }
      }
      return true;
    };
  }

  private parseConditionToFunctions(condition: string | string[]) {
    const funcs = parseCondition(condition, this, this.core);
    funcs.forEach((func, index) => {
      this.setInnerCondition(index, func);
    });
  }

  public setCallBack(key: string, func: () => any) {
    this.callBack.set(key, func);
  }

  private executeCallBack() {
    for (const func of this.callBack.values()) {
      func();
    }
  }

  public removeCallBack(key: string) {
    this.callBack.delete(key);
  }

  public setInnerCondition(id: number, func: filterFunc) {
    const innerId = 'inner' + id;
    this.condition.set(innerId, func);
    this.update();
  }

  public setOuterCondition(id: string, func: filterFunc) {
    this.condition.set(id, func);
    this.update();
  }

  public removeOuterCondition(key: string) {
    this.condition.delete(key);
    this.update();
  }

  public segmentationByRoadID() {
    const data = this.source();
    const trawithSameID: Trajectory[] = [];
    data.forEach((pertra: Trajectory) => {
      const shapingPoints = pertra.shapingPoints;
      // console.log(pertra, shapingPoints, shapingPoints[0]);
      const firstPointSource = shapingPoints[0].attributes.source;

      if (firstPointSource) {
        let preSid: string = firstPointSource.sid ? firstPointSource.sid : '';
        let newshapingPoints: Trajectorypoint[] = [];
        let index = 0;
        shapingPoints.forEach((point: Trajectorypoint) => {
          const source = point.attributes.source;
          if (source) {
            const sid = source.sid ? source.sid : '';
            if (sid && preSid) {
              if (sid == preSid) {
                newshapingPoints.push(point);
              } else {
                newshapingPoints.push(point);
                if (newshapingPoints.length > 1) {
                  const starttime = newshapingPoints[0].basePoint.time;
                  const endtime =
                    newshapingPoints[newshapingPoints.length - 1].basePoint
                      .time;
                  if (starttime && endtime) {
                    const distance = calculateDistance(newshapingPoints);
                    const durtime = calculateDurTime(starttime, endtime);
                    const new_tra = {
                      id: pertra.id + '#' + index,
                      starttime: starttime,
                      endtime: endtime,
                      distance: distance,
                      shapingPoints: newshapingPoints,
                      attributes: {
                        road_id: preSid,
                        durtime: durtime,
                        distance: distance
                      }
                    };
                    trawithSameID.push(new_tra);
                    index++;
                    preSid = sid;
                    newshapingPoints = [];
                    newshapingPoints.push(point);
                  }
                }
              }
            }
          }
        });
      }
    });
    return trawithSameID;
  }

  public aggregationByRoadID() {
    // const configStore = useConfigStore();
    const data = this.source();
    const stageNewRoadnetwork: any[] = [];
    const formedNewRoadnetwork: RoadNetworkItem[] = [];
    const roadnetworkData = this.core.getDQSDatabyID(
      'roadnetwork'
    ) as RoadNetworkItem[];
    data.forEach((pertra: Trajectory) => {
      const attributes = pertra.attributes;
      if (attributes) {
        const road_id = attributes.road_id;
        const distance = attributes.distance;
        const durtime = attributes.durtime;
        const findStageItem = stageNewRoadnetwork.find(
          (obj) => obj.id === road_id
        );
        if (findStageItem) {
          findStageItem.attributes.volume++;
          findStageItem.attributes.distance += distance;
          findStageItem.attributes.durtime += durtime;
        } else {
          const perItem = {
            id: road_id,
            attributes: {
              volume: 1,
              distance: distance,
              durtime: durtime
            }
          };
          stageNewRoadnetwork.push(perItem);
        }
      }
    });

    const volumeDistribute: { volume: number; value: number }[] = [];
    if (stageNewRoadnetwork.length > 0) {
      stageNewRoadnetwork.forEach((perItem) => {
        const found = volumeDistribute.some(
          (item) => item.volume === perItem.attributes.volume
        );
        if (found) {
          // 如果已存在，找到该volume对应的对象并增加其value
          volumeDistribute.forEach((item, index) => {
            if (item.volume === perItem.attributes.volume) {
              volumeDistribute[index].value += 1;
            }
          });
        } else {
          // 如果不存在，创建新的对象并添加到volumeDistribute数组中
          volumeDistribute.push({
            volume: perItem.attributes.volume,
            value: 1
          });
        }
        const findItem = roadnetworkData.find((obj) => obj.id === perItem.id);
        if (findItem) {
          //用路段的距离*volume
          const speed =
            perItem.attributes.durtime == 0
              ? 0
              : (perItem.attributes.volume * findItem.distance) /
                perItem.attributes.durtime;
          const roadNetworkItem = {
            id: perItem.id,
            distance: findItem.distance,
            shapingPoints: findItem.shapingPoints,
            attributes: {
              volume: perItem.attributes.volume,
              speed: speed
            }
          };
          formedNewRoadnetwork.push(roadNetworkItem);
        }
      });
    }
    volumeDistribute.sort((a, b) => a.volume - b.volume);
    console.log('volumeDistribute', volumeDistribute);
    return formedNewRoadnetwork;
  }

  public queryResult() {
    let filterResult: (Trajectory | Trajectorypoint | RoadNetworkItem)[] = [];
    const data = this.source();
    if (this.type == 'filter') {
      filterResult = data.filter((e) => this.match(e));
    } else if (this.type == 'segmentation') {
      console.log('segmentation');
      filterResult = this.segmentationByRoadID();
    } else if (this.type == 'aggregation') {
      filterResult = this.aggregationByRoadID();
      console.log('aggregation');
    } else {
      console.log('other type');
    }
    return filterResult;
  }

  public update() {
    this.updateMatch();
    this.children.forEach((child) => {
      child.update();
    });
    this.executeCallBack();
  }
}
