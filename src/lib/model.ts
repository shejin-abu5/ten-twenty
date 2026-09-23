import 'server-only';
import { cache } from 'react';
import { readAssumptions } from './db/settings';
import { loadModelInputs } from './db/repository';
import { buildCostModel } from './domain/cost-model';
import type { CostModel } from './domain/types';

/**
 * The costed dataset for the current request.
 *
 * React's cache dedupes this across every component in one render, so a page
 * with five tables still reads the database and runs the cost model once.
 */
export const getCostModel = cache((): CostModel => {
  const inputs = loadModelInputs();
  return buildCostModel({ ...inputs, assumptions: readAssumptions() });
});
