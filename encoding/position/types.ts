export interface Vector {
  x: number;
  y: number;
}

export interface PositioningParseResult {
  method: string;
  type: 'index' | 'ratio' | 'count';
  values: number[] | string;
}
