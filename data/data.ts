import type { RelationTreeNode } from '../Trajectoolkit';
import { normalizeDataWithReport } from './normalize';
export type {
  DataProps,
  DataSetting,
  DataType,
  StandardDataFormat
} from './types';
import type {
  DataProps,
  DataType,
  NormalizationReport,
  StandardDataFormat
} from './types';

export type standardDataFormat = StandardDataFormat;

export class Data {
  public id = 'null';
  public type: DataType = 'geojson';
  public data: StandardDataFormat | null = null;
  public normalizationReport: NormalizationReport | null = null;
  public children: RelationTreeNode[] = [];
  public callBack = new Map<string, () => any>();

  constructor(props: DataProps) {
    this.id = props.id;
    this.type = props.type;
    const normalized = normalizeDataWithReport(props.type, props.data);
    this.data = normalized.data;
    this.normalizationReport = normalized.report;
  }

  public update() {
    this.children.forEach((child) => {
      child.update();
    });
    for(const value  of this.callBack.values()){
      value()
    }
  }

  public updateData(newdata: unknown){
    const normalized = normalizeDataWithReport(this.type, newdata);
    this.data = normalized.data;
    this.normalizationReport = normalized.report;
    this.update()
  }
}
