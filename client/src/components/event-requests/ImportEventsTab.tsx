import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  RotateCcw,
  CalendarPlus,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// 2023 Events Import Component
interface ImportEventsTabProps {}

const ImportEventsTab: React.FC<ImportEventsTabProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any>(null);
  const [isFileValid, setIsFileValid] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Import 2023 events mutation
  const import2023EventsMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/import-events/import-2023-events'),
    onSuccess: (data: any) => {
      setImportResults(data);
      toast({
        title: 'Import Complete',
        description: `Successfully imported ${data.imported || 0} events from 2023 (skipped ${data.duplicates || 0} duplicates)`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
    },
    onError: (error: any) => {
      setImportResults({
        error: error?.details || 'Failed to import 2023 events',
      });
      toast({
        title: 'Import Failed',
        description: error?.details || 'Failed to import 2023 events',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const isExcel =
        file.name.toLowerCase().endsWith('.xlsx') ||
        file.name.toLowerCase().endsWith('.xls') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel');

      if (isExcel) {
        setSelectedFile(file);
        setIsFileValid(true);
        setImportResults(null);
      } else {
        setSelectedFile(null);
        setIsFileValid(false);
        toast({
          title: 'Invalid File Type',
          description: 'Please select a valid Excel file (.xlsx or .xls)',
          variant: 'destructive',
        });
      }
    }
  };

  const handleImport = () => {
    if (!selectedFile || !isFileValid) {
      toast({
        title: 'No File Selected',
        description: 'Please select a valid Excel file to import',
        variant: 'destructive',
      });
      return;
    }

    import2023EventsMutation.mutate();
  };

  const resetImport = () => {
    setSelectedFile(null);
    setIsFileValid(false);
    setImportResults(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Import 2023 Events</h2>
          <p className="text-[#236383]">
            Import historical event data from 2023 Excel files
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Data Import
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5" />
            2023 Events Import
          </CardTitle>
          <CardDescription>
            Upload a 2023 Events Excel file to import historical event data.
            This will add past events to the system for tracking and analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="border-2 border-dashed border-[#236383]/30 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="excel-file-input"
                data-testid="input-excel-file"
              />
              <label
                htmlFor="excel-file-input"
                className="cursor-pointer space-y-2"
              >
                <div className="mx-auto w-12 h-12 bg-[#e6f2f5] rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-[#236383]" />
                </div>
                <div>
                  <p className="text-sm font-medium">Select Excel File</p>
                  <p className="text-sm text-[#236383]">
                    Choose a 2023 Events .xlsx or .xls file to import
                  </p>
                </div>
              </label>
            </div>

            {/* File Information */}
            {selectedFile && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      File Selected: {selectedFile.name}
                    </p>
                    <p className="text-sm text-green-600">
                      Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetImport}
                    className="ml-auto"
                    data-testid="button-reset-file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Import Button */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-[#236383]">
              <p>• Only Excel files (.xlsx, .xls) are supported</p>
              <p>• Duplicate events will be automatically skipped</p>
              <p>• Import process may take several minutes for large files</p>
            </div>
            <Button
              onClick={handleImport}
              disabled={
                !selectedFile ||
                !isFileValid ||
                import2023EventsMutation.isPending
              }
              className="bg-brand-primary hover:bg-brand-primary/90"
              data-testid="button-import-events"
            >
              {import2023EventsMutation.isPending ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Events
                </>
              )}
            </Button>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className="space-y-4">
              {importResults.error ? (
                <div className="bg-[#fdf2f5] border border-[#A31C41]/30 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-red-700">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Import Failed</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    {importResults.error}
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-700 mb-3">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Import Successful!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-green-600">
                        <strong>Events Imported:</strong>{' '}
                        {importResults.imported || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-600">
                        <strong>Duplicates Skipped:</strong>{' '}
                        {importResults.duplicates || 0}
                      </p>
                    </div>
                  </div>
                  {importResults.details && (
                    <p className="text-sm text-green-600 mt-2">
                      {importResults.details}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Additional Information */}
          <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-4">
            <h4 className="font-medium text-[#1A2332] mb-2">
              📋 Import Guidelines
            </h4>
            <ul className="text-sm text-[#236383] space-y-1">
              <li>
                • Ensure your Excel file contains 2023 event data in the
                expected format
              </li>
              <li>
                • The system will automatically detect and skip duplicate
                entries
              </li>
              <li>
                • Successfully imported events will appear in the Completed tab
              </li>
              <li>
                • Import status and counts will be displayed above after
                completion
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportEventsTab;