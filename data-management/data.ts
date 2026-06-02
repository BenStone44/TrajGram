import type { RelationTreeNode } from '../Trajectoolkit';
import { normalizeDataByType } from './normalize';
export type {
  DataProps,
  DataSetting,
  DataType,
  StandardDataFormat
} from './types';
import type { DataProps, DataType, StandardDataFormat } from './types';

export type standardDataFormat = StandardDataFormat;

export class Data {
  public id = 'null';
  public type: DataType = 'geojson';
  public data: StandardDataFormat | null = null;
  public children: RelationTreeNode[] = [];
  public callBack = new Map<string, () => any>();

  constructor(props: DataProps) {
    this.id = props.id;
    this.type = props.type;
    this.data = normalizeDataByType(props.type, props.data);
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
    this.data = normalizeDataByType(this.type, newdata)
    this.update()
  }
}
