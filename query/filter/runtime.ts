import type { Trajectory } from '../../interfaces/trajectory';
import type { QueryPredicate } from '../types';

export const executeFilterQuery = async (
  source: () => Promise<Trajectory[]>,
  match: QueryPredicate
): Promise<Trajectory[]> => {
  const data = await source();
  return data.filter((item) => match(item));
};
