import { PageHeader } from '@/components/ui-kit/page-header';
import { ReconciliationNote } from '@/components/ui-kit/data-health';
import { EmptyState } from '@/components/ui-kit/empty-state';
import { ALL_PERIODS } from '@/lib/domain/period';
import { categoryBreakdown } from '@/lib/domain/aggregate';
import { getCostModel } from '@/lib/model';
import { AssumptionsForm } from './assumptions-form';

export default function SettingsPage() {
  const model = getCostModel();

  if (model.entries.length === 0) {
    return (
      <>
        <PageHeader
          title="Assumptions"
          description="Which categories count as billable, and what overhead to add each month."
        />
        <EmptyState
          title="Load some data first"
          description="The billable-category list is built from the categories your timesheet actually uses, so there is nothing to choose from yet."
          action={{ href: '/upload', label: 'Go to data' }}
        />
      </>
    );
  }

  const selected = new Set(model.assumptions.billableCategories);
  const hoursByCategory = new Map(
    categoryBreakdown(model, ALL_PERIODS).map((row) => [row.category, row.hours]),
  );

  // Categories the timesheet uses, plus any that were ticked before but have no
  // hours yet, so a saved choice is never silently dropped.
  const categories = [...new Set([...model.categories, ...selected])]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      hours: hoursByCategory.get(name) ?? 0,
      selected: selected.has(name),
    }));

  return (
    <>
      <PageHeader
        eyebrow="Working"
        title="Assumptions"
        description="These two settings drive every number in the dashboard. They are stored with the data, not in the code."
      />

      <div className="space-y-6">
        <ReconciliationNote check={model.reconciliation} />
        <AssumptionsForm
          categories={categories}
          monthlyOverhead={model.assumptions.monthlyOverhead}
          monthCount={model.months.length}
        />
      </div>
    </>
  );
}
