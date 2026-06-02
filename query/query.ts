import type { Trajectory } from '../interfaces/trajectory';
import { type RelationTreeNode, Trajectoolkit } from '../Trajectoolkit';
import { aggregateTrajectoriesByRoadID } from './aggregation';
import { executeFilterQuery, parseFilterCondition } from './filter';
import {
  evenSplitTrajectories,
  parseSegmentationOperator,
  segmentTrajectoriesByRoadID
} from './segmentation';
import type {
  QueryCallback,
  QueryExecutor,
  QueryPredicate,
  QueryResult,
  QuerySetting,
  QueryType
} from './types';

export type { QuerySetting } from './types';

export class Query {
  id: string;
  source: () => Promise<Trajectory[]>;
  type: QueryType;
  match: QueryPredicate = () => false;
  condition = new Map<string, QueryPredicate>();
  callBack = new Map<string, QueryCallback>();
  children: RelationTreeNode[] = [];
  core: Trajectoolkit;
  private executor: QueryExecutor | null = null;

  constructor(specification: QuerySetting, core: Trajectoolkit) {
    this.core = core;
    this.id = specification.id;
    this.source = () => core.getDQSDatabyID(specification.source);
    core.getDQSbyID(specification.source)?.children.push(this);
    this.type = specification.type;

    if (this.type === 'filter') {
      this.parseConditionToFunctions(specification.condition);
      this.updateMatch();
    } else if (this.type === 'segmentation') {
      const parsed = parseSegmentationOperator(specification.operator);
      if (parsed?.kind === 'road') {
        this.executor = () => this.segmentationByRoadID();
      } else if (parsed?.kind === 'even') {
        this.executor = () => this.evenSplit(parsed.type, parsed.count);
      }
    } else if (this.type === 'aggregation') {
      this.executor = () => this.aggregationByRoadID();
    } else {
      console.log('other type');
    }
  }

  public setSourceFunction(sourceFunc: () => Promise<Trajectory[]>) {
    this.source = sourceFunc;
    this.update();
  }

  public async evenSplit(type: 'D' | 'T', segnum: number) {
    return evenSplitTrajectories(this.source, this.core, type, segnum);
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
    const funcs = parseFilterCondition(condition, this, this.core);
    funcs.forEach((func, index) => {
      this.setInnerCondition(index, func);
    });
  }

  public setCallBack(key: string, func: QueryCallback) {
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

  public setInnerCondition(id: number, func: QueryPredicate) {
    const innerId = 'inner' + id;
    this.condition.set(innerId, func);
    this.update();
  }

  public setOuterCondition(id: string, func: QueryPredicate) {
    this.condition.set(id, func);
    this.update();
  }

  public removeOuterCondition(key: string) {
    this.condition.delete(key);
    this.update();
  }

  public async segmentationByRoadID() {
    return segmentTrajectoriesByRoadID(this.source);
  }

  public async aggregationByRoadID() {
    return aggregateTrajectoriesByRoadID(this.source, this.core);
  }

  public async queryResult(): Promise<QueryResult> {
    if (this.type === 'filter') {
      return executeFilterQuery(this.source, this.match);
    }
    if (this.executor) {
      return this.executor();
    }

    console.log('other type');
    return [];
  }

  public update() {
    this.updateMatch();
    this.children.forEach((child) => {
      child.update();
    });
    this.executeCallBack();
  }
}
