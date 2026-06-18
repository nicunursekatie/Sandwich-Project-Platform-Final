import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ReportIssueDialog } from '@/components/ReportIssueDialog';

export type WorkingRecordContext = {
  recordType?: string;
  recordId?: string;
  recordLabel?: string;
  pageLabel?: string;
};

type IssueReportContextValue = {
  openReportDialog: () => void;
  setWorkingRecord: (record: WorkingRecordContext | null) => void;
};

const IssueReportContext = createContext<IssueReportContextValue | null>(null);

export function useIssueReport() {
  const ctx = useContext(IssueReportContext);
  if (!ctx) {
    return {
      openReportDialog: () => {},
      setWorkingRecord: (_record: WorkingRecordContext | null) => {},
    };
  }
  return ctx;
}

export function IssueReportProvider({ children }: { children: ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [workingRecord, setWorkingRecordState] = useState<WorkingRecordContext | null>(null);

  const openReportDialog = useCallback(() => setDialogOpen(true), []);
  const setWorkingRecord = useCallback(
    (record: WorkingRecordContext | null) => setWorkingRecordState(record),
    []
  );

  const value = useMemo(
    () => ({ openReportDialog, setWorkingRecord }),
    [openReportDialog, setWorkingRecord]
  );

  return (
    <IssueReportContext.Provider value={value}>
      {children}
      <ReportIssueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workingRecord={workingRecord}
      />
    </IssueReportContext.Provider>
  );
}
