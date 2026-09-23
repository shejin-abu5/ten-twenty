'use server';

import { revalidatePath } from 'next/cache';
import { writeAssumptions } from '@/lib/db/settings';

export interface AssumptionsFormState {
  status: 'idle' | 'saved' | 'error';
  message: string;
}

export async function saveAssumptions(
  _previous: AssumptionsFormState,
  formData: FormData,
): Promise<AssumptionsFormState> {
  const billableCategories = formData.getAll('billable').map(String);
  const rawOverhead = String(formData.get('overhead') ?? '0').replace(/[,\s]/g, '');
  const monthlyOverhead = Number(rawOverhead);

  if (!Number.isFinite(monthlyOverhead) || monthlyOverhead < 0) {
    return { status: 'error', message: 'Monthly overhead must be a number of zero or more.' };
  }

  writeAssumptions({ billableCategories, monthlyOverhead });
  revalidatePath('/', 'layout');

  return {
    status: 'saved',
    message:
      billableCategories.length === 0
        ? 'Saved. With no billable categories, every hour is internal and no cost reaches a project.'
        : 'Saved. Every page now uses these assumptions.',
  };
}
