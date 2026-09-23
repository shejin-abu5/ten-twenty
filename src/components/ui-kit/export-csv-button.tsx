'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toCsv, type CsvValue } from '@/lib/csv';

interface ExportCsvButtonProps {
  filename: string;
  /** Header row first, then one array per table row. */
  matrix: CsvValue[][];
  label?: string;
}

export function ExportCsvButton({ filename, matrix, label = 'CSV' }: ExportCsvButtonProps) {
  const download = () => {
    const blob = new Blob([toCsv(matrix)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={download}
      disabled={matrix.length <= 1}
      className="h-7 gap-1.5 px-2 text-xs"
    >
      <Download className="size-3.5" aria-hidden />
      {label}
    </Button>
  );
}
