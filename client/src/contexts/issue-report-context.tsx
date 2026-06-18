import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

export type IssueReportDraft = WorkingRecordContext & {
  whatDoing?: string;
  expectedOutcome?: string;
  actualOutcome?: string;
};

type IssueReportContextValue = {
  openReportDialog: () => void;
  setWorkingRecord: (record: WorkingRecordContext | null) => void;
  reportProblem: (draft?: IssueReportDraft) => void;
};

const IssueReportContext = createContext<IssueReportContextValue | null>(null);

let reportProblemHandler: ((draft: IssueReportDraft) => void) | null = null;

/** Open the report dialog from anywhere (e.g. error toast actions). */
export function reportProblem(draft: IssueReportDraft = {}) {
  reportProblemHandler?.(draft);
}

export function useIssueReport() {
  const ctx = useContext(IssueReportContext);
  if (!ctx) {
    return {
      openReportDialog: () => {},
      setWorkingRecord: (_record: WorkingRecordContext | null) => {},
      reportProblem,
    };
  }
  return ctx;
}

export function IssueReportProvider({ children }: { children: ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [workingRecord, setWorkingRecordState] = useState<WorkingRecordContext | null>(null);
  const [initialDraft, setInitialDraft] = useState<IssueReportDraft | null>(null);
  const workingRecordRef = useRef<WorkingRecordContext | null>(null);

  workingRecordRef.current = workingRecord;

  const openReportDialog = useCallback(() => {
    setInitialDraft(null);
    setDialogOpen(true);
  }, []);

  const setWorkingRecord = useCallback(
    (record: WorkingRecordContext | null) => setWorkingRecordState(record),
    []
  );

  const reportProblemFromContext = useCallback((draft: IssueReportDraft = {}) => {
    setInitialDraft({ ...workingRecordRef.current, ...draft });
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    reportProblemHandler = reportProblemFromContext;
    return () => {
      reportProblemHandler = null;
    };
  }, [reportProblemFromContext]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setInitialDraft(null);
  }, []);

  const value = useMemo(
    () => ({
      openReportDialog,
      setWorkingRecord,
      reportProblem: reportProblemFromContext,
    }),
    [openReportDialog, setWorkingRecord, reportProblemFromContext]
  );

  return (
    <IssueReportContext.Provider value={value}>
      {children}
      <ReportIssueDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        workingRecord={workingRecord}
        initialDraft={initialDraft}
      />
    </IssueReportContext.Provider>
  );
}
