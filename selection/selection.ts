import { type RelationTreeNode, Trajectoolkit } from '../Trajectoolkit';
import { parseLensInfo } from '../data-management/parse';
import { TrajectoryElement } from '../element/trajectory';
import { TrajectoryPointElement } from '../element/trajectorypoint';
import { drawArea } from './area';
import { LensSVG } from './lens_svg';
import { type MouseEventType, MouseSelection } from './mouse';

export type SelectionType =
  | 'mouse.hover'
  | 'mouse.click'
  | 'lens.start'
  | 'lens.end'
  | 'lens.pass'
  | 'draw';

export interface SelectionProps {
  id: string;
  type: SelectionType;
  predicate?: string;
  style?: any;
}

export class Selection {
  public type: SelectionType;
  public component: LensSVG | drawArea | MouseSelection;
  public match?: {
    point: (P: TrajectoryPointElement) => boolean;
    trajectory: (T: TrajectoryElement) => boolean;
  };

  public children: RelationTreeNode[] = [];
  callBack = new Map<string, () => any>();

  constructor(props: SelectionProps, core: Trajectoolkit) {
    // this.core = core;
    this.type = props.type;
    switch (this.type) {
      case 'lens.start':
      case 'lens.end':
      case 'lens.pass':
        {
          const newcomp = new LensSVG(
            core,
            this.type,
            parseLensInfo(props.style, core)
          );
          newcomp.Drag.setOnMouseUpCallback(() => {
            this.children.forEach((child) => {
              child.update();
              core._refresh();
            });
          });
          this.component = newcomp;

          this.match = {
            point: (P: TrajectoryPointElement) => newcomp.match(P, 'point'),
            trajectory: (T: TrajectoryElement) => newcomp.match(T, 'trajectory')
          };
        }
        break;
      case 'mouse.hover':
      case 'mouse.click': {
        const newMouseEvent = new MouseSelection(
          props.type as MouseEventType,
          core
        );
        this.component = newMouseEvent;
        break;
      }
      default: {
        throw new Error('selection type not supported!');
      }
    }
  }

  public draw() {
    if (
      this.type === 'lens.end' ||
      this.type === 'lens.pass' ||
      this.type === 'lens.start'
    )
      (this.component as LensSVG).draw();
  }

  public update() {
    this.children.forEach((child) => {
      child.update();
    });
  }
}
