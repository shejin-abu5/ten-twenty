/**
 * Prints the loaded year's totals and runs the brief's self-check from the
 * command line, so the numbers can be verified without opening the app.
 *
 *   npm run reconcile
 */
import { loadModelInputs } from '@/lib/db/repository';
import { readAssumptions } from '@/lib/db/settings';
import { projectSummaries, summarise } from '@/lib/domain/aggregate';
import { buildCostModel } from '@/lib/domain/cost-model';
import { ALL_PERIODS, shortPeriodLabel } from '@/lib/domain/period';

const money = (value: number) =>
  value.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hours = (value: number) => value.toLocaleString('en-AE', { maximumFractionDigits: 1 });

function main(): void {
  const inputs = loadModelInputs();
  if (inputs.entries.length === 0) {
    console.log('No data loaded. Run `npm run seed` first.');
    return;
  }

  const assumptions = readAssumptions();
  const model = buildCostModel({ ...inputs, assumptions });
  const totals = summarise(model.entries);

  console.log('\nAssumptions');
  console.log(`  billable categories  ${assumptions.billableCategories.join(', ')}`);
  console.log(`  monthly overhead     ${money(assumptions.monthlyOverhead)}`);

  console.log('\nMonth      total h   billable h    indirect/h         cost');
  for (const month of model.months) {
    console.log(
      `  ${shortPeriodLabel(month.year, month.month).padEnd(8)}` +
        `${hours(month.totalHours).padStart(8)}` +
        `${hours(month.billableHours).padStart(13)}` +
        `${money(month.indirectRate).padStart(14)}` +
        `${money(month.salaryTotal + month.overhead).padStart(13)}`,
    );
  }

  console.log('\nProjects');
  for (const summary of projectSummaries(model, ALL_PERIODS)) {
    const margin = summary.margin === null ? '     —' : `${(summary.margin * 100).toFixed(1)}%`;
    console.log(
      `  ${summary.project.refCode.padEnd(12)}` +
        `${hours(summary.hours).padStart(9)} h` +
        `${money(summary.revenue).padStart(16)}` +
        `${money(summary.cost).padStart(16)}` +
        `${margin.padStart(9)}`,
    );
  }

  const { reconciliation: check } = model;
  console.log('\nTotals');
  console.log(`  hours logged         ${hours(totals.totalHours)}`);
  console.log(`  billable hours       ${hours(totals.billableHours)}`);
  console.log(`  productivity         ${((totals.productivity ?? 0) * 100).toFixed(1)}%`);
  console.log(`  revenue recognised   ${money(totals.revenue)}`);
  console.log(`  cost                 ${money(totals.cost)}`);
  console.log(`  margin               ${((totals.margin ?? 0) * 100).toFixed(1)}%`);

  console.log('\nSelf-check');
  console.log(`  total salaries       ${money(check.totalSalaries)}`);
  console.log(`  total overhead       ${money(check.totalOverhead)}`);
  console.log(`  expected cost        ${money(check.expectedCost)}`);
  console.log(`  allocated to work    ${money(check.allocatedCost)}`);
  console.log(`  unabsorbed           ${money(check.unabsorbedCost)}`);
  console.log(`  difference           ${money(check.difference)}`);
  console.log(`  ${check.balanced ? 'BALANCED' : 'OUT BY MORE THAN ONE FILS'}`);

  if (model.gaps.length > 0) {
    console.log(`\nData gaps (${model.gaps.length})`);
    for (const gap of model.gaps) console.log(`  - ${gap.label}: ${gap.detail}`);
  }

  console.log('');
  if (!check.balanced) process.exitCode = 1;
}

main();
