import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, TrendingUp, Info, FileText } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const handleDownloadPDF = () => {
    if (!data?.weeks) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Add header with logo/title
    doc.setFillColor(71, 179, 203); // Brand teal color
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('The Sandwich Project', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Weekly Collections Report', pageWidth / 2, 27, { align: 'center' });

    // Add report metadata
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Report Period: ${data.weeks[0]?.weekStartDate} to ${data.weeks[data.weeks.length - 1]?.weekEndDate}`, 14, 45);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 51);

    // Summary statistics box
    doc.setFillColor(224, 242, 245); // Light teal
    doc.roundedRect(14, 57, pageWidth - 28, 30, 3, 3, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 79, 97); // Dark teal

    const col1X = 20;
    const col2X = pageWidth / 2 - 10;
    const col3X = pageWidth - 70;

    doc.text('Total Weeks:', col1X, 70);
    doc.text('Total Collections:', col2X, 70);
    doc.text('Total Sandwiches:', col3X, 70);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(0, 126, 140); // Brand primary
    doc.text(data.totalWeeks.toString(), col1X, 79);
    doc.text(data.weeks.reduce((sum, w) => sum + w.collectionCount, 0).toLocaleString(), col2X, 79);
    doc.text(data.grandTotal.toLocaleString(), col3X, 79);

    // Weekly data table
    const tableData = data.weeks.map((week) => [
      week.weekStartDate,
      week.weekEndDate,
      week.collectionCount.toString(),
      week.individual.toLocaleString(),
      week.group1.toLocaleString(),
      week.group2.toLocaleString(),
      week.groupCollections.toLocaleString(),
      week.totalSandwiches.toLocaleString(),
    ]);

    autoTable(doc, {
      startY: 95,
      head: [['Week Start', 'Week End', 'Collections', 'Individual', 'Group 1', 'Group 2', 'Group Total', 'Total']],
      body: tableData,
      foot: [['Grand Total', '', data.weeks.length.toString(), '', '', '', '', data.grandTotal.toLocaleString()]],
      theme: 'striped',
      headStyles: {
        fillColor: [71, 179, 203], // Brand teal
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      footStyles: {
        fillColor: [26, 79, 97], // Dark teal
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [240, 248, 250], // Very light teal
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 22 },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    // Add footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    doc.save(`TSP-Weekly-Collections-${startDate}-to-${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl" style={{ backgroundColor: '#E0F2F5' }}>
          <TrendingUp className="w-6 h-6" style={{ color: '#007E8C' }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Weekly Collections Report</h1>
          <p className="text-slate-600">View sandwich collection totals by week (Wednesday-Tuesday)</p>
        </div>
      </div>

      {/* How it Works Info */}
      <Alert className="border-2" style={{ backgroundColor: '#E0F2F5', borderColor: '#007E8C' }}>
        <Info className="h-6 w-6" style={{ color: '#007E8C' }} />
        <AlertDescription className="text-slate-800 text-base leading-relaxed">
          <strong className="text-lg" style={{ color: '#1A4F61' }}>How weekly grouping works:</strong> This report groups collections into <strong>Wednesday-to-Tuesday weeks</strong>. 
          When you enter a start date, the report will include the <strong>entire week</strong> containing that date (starting from the Wednesday of that week). 
          The same applies to your end date - it includes the full week ending on the Tuesday that contains or follows your end date.
          <div className="mt-3 text-base bg-white/80 rounded-lg p-3" style={{ borderWidth: '1px', borderColor: '#47B3CB' }}>
            <strong style={{ color: '#1A4F61' }}>Example:</strong> If you enter 11/22/2025 (a Saturday), the report will include the full week of Nov 19-25, 2025 (Wed-Tue).
          </div>
        </AlertDescription>
      </Alert>

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
              <p className="text-xs text-slate-500 mt-1">
                Report will start from the Wednesday of this week
              </p>
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
              <p className="text-xs text-slate-500 mt-1">
                Report will end on the Tuesday of this week
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="bg-brand-primary hover:bg-brand-primary-dark"
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
              <>
                <Button
                  onClick={handleDownloadPDF}
                  className="gap-2 bg-brand-primary hover:bg-brand-primary-dark border-2 border-brand-orange"
                  title="Download a professionally formatted PDF report"
                >
                  <FileText className="w-4 h-4" />
                  Export to PDF
                </Button>
                <Button
                  onClick={handleDownloadCSV}
                  className="gap-2"
                  variant="outline"
                  style={{ borderColor: '#007E8C', color: '#007E8C' }}
                  title="Download raw data as CSV for Excel"
                >
                  <Download className="w-4 h-4" />
                  Export to CSV
                </Button>
              </>
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
        <>
          {/* Date Range Summary */}
          {data.weeks.length > 0 && (
            <Alert className="border-2" style={{ backgroundColor: '#E0F2F5', borderColor: '#007E8C' }}>
              <Info className="h-5 w-5" style={{ color: '#007E8C' }} />
              <AlertDescription className="text-slate-800 text-base">
                <strong className="text-base" style={{ color: '#1A4F61' }}>Showing collections from:</strong> {data.weeks[0].weekStartDate} to {data.weeks[data.weeks.length - 1].weekEndDate}
                <div className="text-sm mt-2 text-slate-700">
                  Your selected date range ({data.startDate} to {data.endDate}) was expanded to include complete Wednesday-Tuesday weeks.
                </div>
              </AlertDescription>
            </Alert>
          )}

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
                  <p className="text-2xl font-bold" style={{ color: '#007E8C' }}>{data.grandTotal.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-white overflow-hidden">
            {data.weeks.length > 0 ? (
              <>
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
                          <TableCell className="text-right font-bold" style={{ color: '#007E8C' }}>
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
                    <p className="text-3xl font-bold" style={{ color: '#007E8C' }}>{data.grandTotal.toLocaleString()}</p>
                    <p className="text-sm text-slate-600 mt-2">
                      across {data.weeks.length} weeks
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center">
                <p className="text-slate-600">No collections found in this date range.</p>
              </div>
            )}
          </Card>
        </>
      )}
      

      {/* Empty State */}
      {!data && !isLoading && (
        <Card className="p-12 text-center bg-slate-50">
          <p className="text-slate-600 mb-4">
            Select a date range and click "Generate Report" to view weekly sandwich collection totals grouped by Wednesday-Tuesday weeks.
          </p>
        </Card>
      )}
    </div>
  );
}
