import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Download, TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface WeeklyData {
  weekStartDate: string;
  weekEndDate: string;
  collectionCount: number;
  totalSandwiches: number;
  individual: number;
  group1: number;
  group2: number;
  groupCollections: number;
}

interface WeeklyReportResponse {
  startDate: string;
  endDate: string;
  weeks: WeeklyData[];
  totalWeeks: number;
  grandTotal: number;
}

export default function WeeklyCollectionsReport() {
  const [startDate, setStartDate] = useState(() => {
    // Default to 3 months ago
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    // Default to today
    return new Date().toISOString().split('T')[0];
  });

  const { data, isLoading, error, refetch } = useQuery<WeeklyReportResponse>({
    queryKey: ['/api/reports/weekly-collections', startDate, endDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/reports/weekly-collections?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) throw new Error('Failed to fetch weekly data');
      return response.json();
    },
    enabled: false,
  });

  const handleGenerate = () => {
    refetch();
  };

  const handleDownloadCSV = () => {
    if (!data?.weeks) return;

    const rows = [
      ['Week Starting', 'Week Ending', 'Collections', 'Individual', 'Group Type 1', 'Group Type 2', 'Group Collections', 'Total Sandwiches'],
      ...data.weeks.map((week) => [
        week.weekStartDate,
        week.weekEndDate,
        week.collectionCount,
        week.individual,
        week.group1,
        week.group2,
        week.groupCollections,
        week.totalSandwiches,
      ]),
      [],
      ['Total', '', data.weeks.length, '', '', '', '', data.grandTotal],
    ];

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-collections-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
          <TrendingUp className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Weekly Collections Report</h1>
          <p className="text-slate-600">View sandwich collection totals by week (Wednesday-Tuesday)</p>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card className="p-6 bg-white">
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Select Date Range</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Report'
              )}
            </Button>
            {data?.weeks && data.weeks.length > 0 && (
              <Button
                onClick={handleDownloadCSV}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="text-red-800 font-medium">
            Error: {error instanceof Error ? error.message : 'Failed to load data'}
          </p>
        </Card>
      )}

      {/* Results */}
      {data && (
        <Card className="bg-white overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-600">Total Weeks</p>
                <p className="text-2xl font-bold text-slate-900">{data.totalWeeks}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Collections</p>
                <p className="text-2xl font-bold text-slate-900">
                  {data.weeks.reduce((sum, w) => sum + w.collectionCount, 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Sandwiches</p>
                <p className="text-2xl font-bold text-blue-600">{data.grandTotal.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week Starting</TableHead>
                  <TableHead className="text-right">Collections</TableHead>
                  <TableHead className="text-right">Individual</TableHead>
                  <TableHead className="text-right">Group 1</TableHead>
                  <TableHead className="text-right">Group 2</TableHead>
                  <TableHead className="text-right">Group Collections</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.weeks.map((week, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      <div className="text-sm">
                        <p className="font-semibold text-slate-900">{week.weekStartDate}</p>
                        <p className="text-slate-600">to {week.weekEndDate}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-slate-700">
                      {week.collectionCount}
                    </TableCell>
                    <TableCell className="text-right text-slate-700">
                      {week.individual.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-slate-700">
                      {week.group1.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-slate-700">
                      {week.group2.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-slate-700">
                      {week.groupCollections.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-600">
                      {week.totalSandwiches.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
            <div className="text-right">
              <p className="text-sm text-slate-600 mb-1">Grand Total</p>
              <p className="text-3xl font-bold text-blue-600">{data.grandTotal.toLocaleString()}</p>
              <p className="text-sm text-slate-600 mt-2">
                across {data.weeks.length} weeks
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!data && !isLoading && (
        <Card className="p-12 text-center bg-slate-50">
          <p className="text-slate-600 mb-4">
            Select a date range and click "Generate Report" to view weekly sandwich collection totals.
          </p>
          <p className="text-sm text-slate-500">
            Weeks are calculated as Wednesday to Tuesday to match your collection schedule.
          </p>
        </Card>
      )}
    </div>
  );
}
