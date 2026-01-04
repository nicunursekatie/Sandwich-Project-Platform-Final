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
import { FileSpreadsheet, Check, Loader2, ExternalLink, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface ProposeToSheetButtonProps {
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

export function ProposeToSheetButton({
  eventId,
  organizationName,
  variant = 'ghost',
  size = 'sm',
  className = '',
}: ProposeToSheetButtonProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if there's already a pending proposal for this event
  const { data: pendingCheck } = useQuery({
    queryKey: ['planning-sheet-proposals', 'pending', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/planning-sheet-proposals?status=pending`);
      if (!res.ok) return [];
      const proposals = await res.json();
      return proposals.filter((p: any) => p.eventRequestId === eventId);
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Preview the data that would be sent
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['planning-sheet-preview', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/planning-sheet-proposals/preview/${eventId}`);
      if (!res.ok) throw new Error('Failed to load preview');
      return res.json();
    },
    enabled: showPreview,
  });

  // Create proposal mutation
  const proposeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/planning-sheet-proposals/propose-event/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Event ready for scheduling sheet' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create proposal');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Proposal created',
        description: 'The event has been proposed for the Planning Sheet. Review it in the proposals page.',
      });
      setShowPreview(false);
      queryClient.invalidateQueries({ queryKey: ['planning-sheet-proposals'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create proposal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const hasPendingProposal = pendingCheck && pendingCheck.length > 0;

  // Key fields to show in collapsed view
  const getKeyFields = (rawData: string[]) => [
    { label: 'Date', value: rawData[0] },
    { label: 'Group', value: rawData[2] },
    { label: 'Staffing', value: rawData[9] },
    { label: 'Sandwiches', value: rawData[10] },
    { label: 'Contact', value: rawData[15] },
  ].filter(f => f.value);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            onClick={() => setShowPreview(true)}
            disabled={hasPendingProposal}
            className={`${hasPendingProposal ? 'text-gray-400' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'} ${className}`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {size !== 'icon' && size !== 'sm' && <span className="ml-2">Propose to Sheet</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasPendingProposal ? (
            <p>Pending proposal exists - check the proposals page</p>
          ) : (
            <p>Propose adding this event to the Planning Sheet</p>
          )}
        </TooltipContent>
      </Tooltip>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Propose to Planning Sheet
            </DialogTitle>
            <DialogDescription>
              Review the data that will be proposed for the Planning Sheet. A team member will review and approve before it's written.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{organizationName}</h3>
              {hasPendingProposal && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                  Pending proposal exists
                </Badge>
              )}
            </div>

            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : previewData?.rawData ? (
              <div className="space-y-4">
                {/* Warning if event already exists in sheet */}
                {previewData.existingSheetRow && (
                  <Alert variant="destructive" className="bg-orange-50 border-orange-200">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="text-orange-800">Event already exists in sheet</AlertTitle>
                    <AlertDescription className="text-orange-700">
                      Found at row {previewData.existingSheetRow.rowIndex}: {previewData.existingSheetRow.groupName} on {previewData.existingSheetRow.date}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Potential matches warning */}
                {!previewData.existingSheetRow && previewData.potentialMatches?.length > 0 && (
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800">Possible duplicates found</AlertTitle>
                    <AlertDescription className="text-yellow-700">
                      <div className="mt-2 space-y-1">
                        {previewData.potentialMatches.map((match: any, i: number) => (
                          <div key={i} className="text-xs">
                            Row {match.rowIndex}: {match.groupName} - {match.date}
                          </div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Side-by-side comparison if existing row found */}
                {previewData.existingSheetRow ? (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Side-by-side comparison:</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs bg-gray-50 p-3 rounded max-h-64 overflow-y-auto">
                      <div className="font-semibold text-gray-600">Field</div>
                      <div className="font-semibold text-gray-600">Currently in Sheet</div>
                      <div className="font-semibold text-green-700">App Would Send</div>

                      {[
                        { label: 'Date', sheet: previewData.existingSheetRow.date, app: previewData.rawData[0] },
                        { label: 'Group Name', sheet: previewData.existingSheetRow.groupName, app: previewData.rawData[2] },
                        { label: 'Start Time', sheet: previewData.existingSheetRow.eventStartTime, app: previewData.rawData[3] },
                        { label: 'Pick Up Time', sheet: previewData.existingSheetRow.pickUpTime, app: previewData.rawData[5] },
                        { label: 'Staffing', sheet: previewData.existingSheetRow.staffing, app: previewData.rawData[9] },
                        { label: 'Sandwiches', sheet: previewData.existingSheetRow.estimateSandwiches, app: previewData.rawData[10] },
                        { label: 'Type', sheet: previewData.existingSheetRow.deliOrPbj, app: previewData.rawData[11] },
                        { label: 'Contact', sheet: previewData.existingSheetRow.contactName, app: previewData.rawData[15] },
                        { label: 'Email', sheet: previewData.existingSheetRow.email, app: previewData.rawData[16] },
                        { label: 'TSP Contact', sheet: previewData.existingSheetRow.tspContact, app: previewData.rawData[18] },
                      ].map((row, i) => (
                        <>
                          <div key={`${i}-label`} className="font-medium text-gray-600 border-t border-gray-200 pt-1">{row.label}</div>
                          <div key={`${i}-sheet`} className={`border-t border-gray-200 pt-1 ${row.sheet !== row.app ? 'bg-red-50 px-1 rounded' : ''}`}>
                            {row.sheet || <span className="text-gray-400">(empty)</span>}
                          </div>
                          <div key={`${i}-app`} className={`border-t border-gray-200 pt-1 ${row.sheet !== row.app ? 'bg-green-50 px-1 rounded font-medium' : ''}`}>
                            {row.app || <span className="text-gray-400">(empty)</span>}
                          </div>
                        </>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Key fields summary for new rows */}
                    <div className="flex flex-wrap gap-2">
                      {getKeyFields(previewData.rawData).map((field, i) => (
                        <span key={i} className="text-sm bg-gray-100 px-2 py-1 rounded">
                          <strong>{field.label}:</strong> {field.value}
                        </span>
                      ))}
                    </div>

                    {/* Expand/collapse all fields */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllFields(!showAllFields)}
                      className="text-xs"
                    >
                      {showAllFields ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                      {showAllFields ? 'Hide all fields' : 'Show all fields'}
                    </Button>

                    {showAllFields && (
                      <div className="bg-gray-50 p-4 rounded space-y-2 max-h-64 overflow-y-auto">
                        {previewData.rawData.map((value: string, idx: number) => (
                          value && (
                            <div key={idx} className="flex border-b border-gray-200 pb-1 text-sm">
                              <span className="font-medium text-gray-600 w-40 flex-shrink-0">
                                {COLUMN_LABELS[idx] || `Column ${idx}`}
                              </span>
                              <span className="text-gray-900">{value}</span>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                  <strong>What happens next:</strong> This creates a proposal that will be reviewed before any changes are made to the Google Sheet. You can review all proposals at{' '}
                  <a href="/planning-sheet-proposals" className="underline inline-flex items-center gap-1">
                    Planning Sheet Proposals <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">
                Unable to load preview data
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => proposeMutation.mutate()}
              disabled={proposeMutation.isPending || hasPendingProposal}
            >
              {proposeMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Create Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
