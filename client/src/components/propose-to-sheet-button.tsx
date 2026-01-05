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
import { FileSpreadsheet, Check, Loader2, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';

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
  const [showDialog, setShowDialog] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingProposal, isLoading: proposalLoading, refetch: refetchProposal } = useQuery({
    queryKey: ['planning-sheet-proposals', 'event', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/planning-sheet-proposals?status=pending`);
      if (!res.ok) return null;
      const proposals = await res.json();
      const match = proposals.find((p: any) => p.eventRequestId === eventId);
      return match || null;
    },
    staleTime: 30000,
  });

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['planning-sheet-preview', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/planning-sheet-proposals/preview/${eventId}`);
      if (!res.ok) throw new Error('Failed to load preview');
      return res.json();
    },
    enabled: showDialog && !existingProposal,
  });

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
      queryClient.invalidateQueries({ queryKey: ['planning-sheet-proposals'] });
      refetchProposal();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create proposal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const res = await fetch(`/api/planning-sheet-proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Withdrawn by user' }),
      });
      if (!res.ok) throw new Error('Failed to withdraw proposal');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Proposal withdrawn' });
      queryClient.invalidateQueries({ queryKey: ['planning-sheet-proposals'] });
      refetchProposal();
      setShowDialog(false);
    },
  });

  const hasPendingProposal = !!existingProposal;

  const getKeyFields = (rawData: string[]) => [
    { label: 'Date', value: rawData[0] },
    { label: 'Group', value: rawData[2] },
    { label: 'Staffing', value: rawData[9] },
    { label: 'Sandwiches', value: rawData[10] },
    { label: 'Contact', value: rawData[15] },
  ].filter(f => f.value);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            onClick={() => setShowDialog(true)}
            className={`${hasPendingProposal ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'} ${className}`}
            data-testid="button-propose-to-sheet"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {hasPendingProposal && <span className="ml-1 w-2 h-2 bg-yellow-500 rounded-full" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasPendingProposal ? 'View pending proposal' : 'Propose to Planning Sheet'}
        </TooltipContent>
      </Tooltip>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              {hasPendingProposal ? 'Proposal Status' : 'Propose to Planning Sheet'}
            </DialogTitle>
            <DialogDescription>
              {hasPendingProposal 
                ? 'This event has a pending proposal for the Planning Sheet.'
                : 'Review the data that will be proposed for the Planning Sheet.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{organizationName}</h3>
              {hasPendingProposal && getStatusBadge(existingProposal.status)}
            </div>

            {hasPendingProposal ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                    <CheckCircle className="w-5 h-5" />
                    Proposal Created Successfully
                  </div>
                  <p className="text-sm text-green-700">
                    Your proposal is awaiting review. A team member will approve or reject it before any changes are made to the Planning Sheet.
                  </p>
                </div>

                {existingProposal.proposedRowData && (
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllFields(!showAllFields)}
                      className="text-xs"
                    >
                      {showAllFields ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                      {showAllFields ? 'Hide proposed data' : 'View proposed data'}
                    </Button>

                    {showAllFields && (
                      <div className="bg-gray-50 p-4 rounded space-y-2 max-h-64 overflow-y-auto">
                        {(typeof existingProposal.proposedRowData === 'string' 
                          ? JSON.parse(existingProposal.proposedRowData) 
                          : existingProposal.proposedRowData
                        ).map((value: string, idx: number) => (
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
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  Created: {new Date(existingProposal.proposedAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <>
                {previewLoading || proposalLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : previewData?.rawData ? (
                  <div className="space-y-4">
                    {previewData.existingSheetRow && (
                      <Alert variant="destructive" className="bg-orange-50 border-orange-200">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertTitle className="text-orange-800">Event already exists in sheet</AlertTitle>
                        <AlertDescription className="text-orange-700">
                          Found at row {previewData.existingSheetRow.rowIndex}: {previewData.existingSheetRow.groupName} on {previewData.existingSheetRow.date}
                        </AlertDescription>
                      </Alert>
                    )}

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

                    <div className="flex flex-wrap gap-2">
                      {getKeyFields(previewData.rawData).map((field, i) => (
                        <span key={i} className="text-sm bg-gray-100 px-2 py-1 rounded">
                          <strong>{field.label}:</strong> {field.value}
                        </span>
                      ))}
                    </div>

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
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-4">
                    Unable to load preview data
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            {hasPendingProposal ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => withdrawMutation.mutate(existingProposal.id)}
                  disabled={withdrawMutation.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {withdrawMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Withdraw Proposal
                </Button>
                <Button onClick={() => setShowDialog(false)}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => proposeMutation.mutate()}
                  disabled={proposeMutation.isPending}
                >
                  {proposeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Create Proposal
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
