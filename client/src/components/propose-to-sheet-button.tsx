import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Check, Loader2, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';

interface PushToSheetButtonProps {
  eventId: number;
  organizationName: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

const COLUMN_LABELS: Record<number, string> = {
  0: 'Date',
  1: 'Day of Week',
  2: 'Group Name',
  3: 'Event Start Time',
  4: 'Event End Time',
  5: 'Pick Up Time',
  6: 'Pick Up Next Day?',
  7: 'All Details',
  8: 'Van Booked?',
  9: 'Staffing',
  10: 'Estimate # Sandwiches',
  11: 'Deli or PBJ?',
  12: 'Final # Sandwiches',
  13: 'Social Post',
  14: 'Sent Toolkit?',
  15: 'Contact Name',
  16: 'Email',
  17: 'Phone',
  18: 'TSP Contact',
  19: 'Address',
  20: 'Recipient/Host',
  21: 'After Event Notes',
  22: 'Cancelled',
  23: 'Notes',
  24: "Add'l Notes",
  25: 'Waiting On',
};

// Keep ProposeToSheetButton as an alias for backward compatibility
export { PushToSheetButton as ProposeToSheetButton };

export function PushToSheetButton({
  eventId,
  organizationName,
  variant = 'ghost',
  size = 'sm',
  className = '',
}: PushToSheetButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const [showExistingFields, setShowExistingFields] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch preview data when dialog opens
  const { data: previewData, isLoading: previewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ['planning-sheet-preview', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/planning-sheet-proposals/preview/${eventId}`);
      if (!res.ok) throw new Error('Failed to load preview');
      return res.json();
    },
    enabled: showDialog,
  });

  // Direct push mutation - skips the proposal system entirely
  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/planning-sheet-proposals/push-event/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to push to sheet');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Successfully pushed to Planning Sheet!',
        description: data.isUpdate
          ? `Updated row ${data.rowIndex} in the Planning Sheet.`
          : `Added new row ${data.rowIndex} to the Planning Sheet.`,
      });
      queryClient.invalidateQueries({ queryKey: ['planning-sheet-preview', eventId] });
      setShowDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to push to sheet',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getKeyFields = (rawData: string[]) => [
    { label: 'Date', value: rawData[0] },
    { label: 'Group', value: rawData[2] },
    { label: 'Staffing', value: rawData[9] },
    { label: 'Est. Sandwiches', value: rawData[10] },
    { label: 'Contact', value: rawData[15] },
  ].filter(f => f.value);

  const hasExistingRow = previewData?.existingSheetRow;
  const hasPotentialDuplicates = previewData?.potentialMatches?.length > 0;

  // Compare values to highlight what's changing
  const getFieldComparison = (idx: number, newValue: string, existingRow: any) => {
    if (!existingRow) return null;

    const fieldMap: Record<number, string> = {
      0: 'date',
      2: 'groupName',
      3: 'eventStartTime',
      4: 'eventEndTime',
      5: 'pickUpTime',
      9: 'staffing',
      10: 'estimateSandwiches',
      11: 'deliOrPbj',
      12: 'finalSandwiches',
      15: 'contactName',
      16: 'email',
      17: 'phone',
      18: 'tspContact',
      19: 'address',
      20: 'recipientHost',
    };

    const fieldKey = fieldMap[idx];
    if (!fieldKey) return null;

    const oldValue = existingRow[fieldKey] || '';
    if (oldValue === newValue) return null;

    return { oldValue, newValue };
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            onClick={() => setShowDialog(true)}
            className={`text-blue-600 hover:text-blue-700 hover:bg-blue-50 ${className}`}
            data-testid="button-push-to-sheet"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Push to Planning Sheet
        </TooltipContent>
      </Tooltip>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Push to Planning Sheet
            </DialogTitle>
            <DialogDescription>
              Review exactly what will be added to the Planning Sheet, then push when ready.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{organizationName}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchPreview()}
                disabled={previewLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${previewLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading preview...</span>
              </div>
            ) : previewData?.rawData ? (
              <div className="space-y-4">
                {/* Action summary banner */}
                {hasExistingRow ? (
                  <Alert className="bg-amber-50 border-amber-300">
                    <RefreshCw className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">This will UPDATE an existing row</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      Row {previewData.existingSheetRow.rowIndex} already exists for this event.
                      Pushing will overwrite the existing data with the values shown below.
                    </AlertDescription>
                  </Alert>
                ) : hasPotentialDuplicates ? (
                  <Alert className="bg-yellow-50 border-yellow-300">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800">Possible duplicates detected</AlertTitle>
                    <AlertDescription className="text-yellow-700">
                      <p className="mb-2">Similar rows found in the sheet. This will add a NEW row:</p>
                      <div className="space-y-1 text-sm">
                        {previewData.potentialMatches.map((match: any, i: number) => (
                          <div key={i} className="bg-yellow-100 px-2 py-1 rounded">
                            Row {match.rowIndex}: <strong>{match.groupName}</strong> - {match.date}
                          </div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-green-50 border-green-300">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Adding a new row</AlertTitle>
                    <AlertDescription className="text-green-700">
                      No existing row found for this event. A new row will be added to the Planning Sheet.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Show existing data if updating */}
                {hasExistingRow && (
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setShowExistingFields(!showExistingFields)}
                      className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <span className="font-medium text-gray-700">Current data in sheet (Row {previewData.existingSheetRow.rowIndex})</span>
                      {showExistingFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showExistingFields && (
                      <div className="p-4 bg-gray-50 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div><strong>Date:</strong> {previewData.existingSheetRow.date || '-'}</div>
                          <div><strong>Group:</strong> {previewData.existingSheetRow.groupName || '-'}</div>
                          <div><strong>Start:</strong> {previewData.existingSheetRow.eventStartTime || '-'}</div>
                          <div><strong>End:</strong> {previewData.existingSheetRow.eventEndTime || '-'}</div>
                          <div><strong>Pickup:</strong> {previewData.existingSheetRow.pickUpTime || '-'}</div>
                          <div><strong>Staffing:</strong> {previewData.existingSheetRow.staffing || '-'}</div>
                          <div><strong>Est. Sandwiches:</strong> {previewData.existingSheetRow.estimateSandwiches || '-'}</div>
                          <div><strong>Type:</strong> {previewData.existingSheetRow.deliOrPbj || '-'}</div>
                          <div><strong>Contact:</strong> {previewData.existingSheetRow.contactName || '-'}</div>
                          <div><strong>TSP Contact:</strong> {previewData.existingSheetRow.tspContact || '-'}</div>
                          <div className="col-span-2"><strong>Address:</strong> {previewData.existingSheetRow.address || '-'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* What will be pushed - key fields summary */}
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-800">
                      {hasExistingRow ? 'New values to write:' : 'Data to add:'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getKeyFields(previewData.rawData).map((field, i) => (
                      <span key={i} className="text-sm bg-white px-3 py-1.5 rounded border border-blue-200 shadow-sm">
                        <strong className="text-blue-700">{field.label}:</strong>{' '}
                        <span className="text-gray-800">{field.value}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Full field list */}
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowAllFields(!showAllFields)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <span className="font-medium text-gray-700">View all {previewData.rawData.filter(Boolean).length} fields</span>
                    {showAllFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showAllFields && (
                    <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                      {previewData.rawData.map((value: string, idx: number) => {
                        if (!value && !hasExistingRow) return null;

                        const comparison = hasExistingRow ? getFieldComparison(idx, value, previewData.existingSheetRow) : null;
                        const isChanged = comparison !== null;

                        return (
                          <div
                            key={idx}
                            className={`flex border-b border-gray-200 pb-2 text-sm ${isChanged ? 'bg-yellow-50 -mx-2 px-2 py-1 rounded' : ''}`}
                          >
                            <span className="font-medium text-gray-600 w-40 flex-shrink-0">
                              {COLUMN_LABELS[idx] || `Column ${idx}`}
                              {isChanged && <Badge className="ml-2 text-[10px] bg-yellow-200 text-yellow-800">Changed</Badge>}
                            </span>
                            <div className="flex-1">
                              {isChanged && comparison ? (
                                <div className="space-y-1">
                                  <div className="text-red-600 line-through text-xs">{comparison.oldValue || '(empty)'}</div>
                                  <div className="text-green-700 font-medium">{value || '(empty)'}</div>
                                </div>
                              ) : (
                                <span className="text-gray-900">{value || <span className="text-gray-400">(empty)</span>}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unable to load preview</AlertTitle>
                <AlertDescription>
                  Could not fetch the event data. Please try again or contact support.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => pushMutation.mutate()}
              disabled={pushMutation.isPending || previewLoading || !previewData?.rawData}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {pushMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  {hasExistingRow ? 'Update Row' : 'Add to Sheet'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
