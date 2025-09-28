import type { RelationTreeNode } from '../Trajectoolkit';
import type { RoadNetworkItem } from '../interfaces/road-network';
import type { Trajectory } from '../interfaces/trajectory';
import type { FeatureCollection, Feature } from 'geojson';

export type DataType = 'trajectory' | 'roadnetwork' | 'geojson';
export type standardDataFormat =
  | Trajectory[]
  | RoadNetworkItem[]
  | FeatureCollection
  | Feature;

export interface DataSetting {
  id: string;
  type: DataType;
  url: string;
}

export interface DataProps {
  id: string;
  type: DataType;
  data: standardDataFormat | null;
}

export class Data {
  public id = 'null';
  public type: DataType = 'geojson';
  public data: standardDataFormat | null = null;
  public children: RelationTreeNode[] = [];
  public callBack = new Map<string, () => any>();

  constructor(props: DataProps) {
    this.id = props.id;
    this.data = props.data;
    this.type = props.type;
  }

  public update() {
    this.children.forEach((child) => {
      child.update();
    });
    for(const value  of this.callBack.values()){
      value()
    }
  }

  public updateData(newdata: any){
    this.data = newdata
    this.update()
  }
}
