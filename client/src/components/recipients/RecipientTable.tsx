import type React from 'react';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Recipient } from '@shared/schema';
import {
  getRecipientRegion,
  type SortColumn,
  type SortDirection,
} from './recipient-schedule-utils';
import {
  InlineTextCell,
  InlineContractCell,
  InlineScheduleCell,
  InlineSurveyCell,
  InlineCadenceCell,
  InlineEstimatedSandwichesCell,
  InlinePeopleServedCell,
  InlinePeopleServedFrequencyCell,
  InlineFruitOrSnacksCell,
  InlineFocusAreasCell,
  InlinePrimaryContactCell,
} from './recipient-table-inline-cells';

// localStorage key for persisted column widths. Bump the suffix if column
// IDs ever change so stale persisted widths don't break a new layout.
const COLUMN_WIDTHS_STORAGE_KEY = 'recipientTableColumnWidths.v1';

// Minimum column width while resizing — small enough to be useful, large
// enough to keep the resize handle clickable.
const MIN_COLUMN_WIDTH_PX = 80;

const COLUMNS: { id: SortColumn; label: string; className?: string; defaultWidth: number }[] = [
  { id: 'name', label: 'Name', className: 'min-w-[160px]', defaultWidth: 200 },
  { id: 'collectionDays', label: 'Collection Days', className: 'min-w-[130px]', defaultWidth: 150 },
  { id: 'feedingDays', label: 'Feeding Days', className: 'min-w-[120px]', defaultWidth: 140 },
  { id: 'estimatedSandwiches', label: 'Est. Sandwiches', className: 'w-[110px]', defaultWidth: 120 },
  { id: 'peopleServed', label: 'People served', className: 'w-[110px]', defaultWidth: 110 },
  { id: 'peopleServedFrequency', label: 'Freq.', className: 'w-[90px]', defaultWidth: 100 },
  { id: 'fruit', label: 'Fruit', className: 'w-[80px]', defaultWidth: 85 },
  { id: 'snacks', label: 'Snacks', className: 'w-[80px]', defaultWidth: 85 },
  { id: 'cadence', label: 'Cadence', className: 'min-w-[130px]', defaultWidth: 150 },
  { id: 'sandwichType', label: 'Sandwich Type', className: 'w-[110px]', defaultWidth: 120 },
  { id: 'reportingGroup', label: 'Reporting Group', className: 'min-w-[120px]', defaultWidth: 140 },
  { id: 'tspContact', label: 'TSP Contact', className: 'min-w-[120px]', defaultWidth: 140 },
  { id: 'focusArea', label: 'Focus Area', className: 'min-w-[140px]', defaultWidth: 160 },
  { id: 'region', label: 'Region', className: 'min-w-[120px]', defaultWidth: 140 },
  { id: 'primaryContact', label: 'Primary Contact', className: 'min-w-[160px]', defaultWidth: 180 },
  { id: 'contract', label: 'Contract', className: 'w-[100px]', defaultWidth: 110 },
  { id: 'survey', label: 'Survey', className: 'w-[90px]', defaultWidth: 100 },
];

interface RecipientTableProps {
  recipients: Recipient[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  onRowClick: (recipient: Recipient) => void;
  highlightedId?: number;
  highlightRowRef?: React.RefObject<HTMLTableRowElement>;
  canEdit?: boolean;
  savingId?: number | null;
  onUpdateRecipient?: (recipient: Recipient, updates: Partial<Recipient>) => void;
}

function SortIcon({
  column,
  sortColumn,
  sortDirection,
}: {
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}) {
  if (sortColumn !== column) {
    return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
  }
  return sortDirection === 'asc' ? (
    <ArrowUp className="w-3.5 h-3.5 text-[#007E8C]" />
  ) : (
    <ArrowDown className="w-3.5 h-3.5 text-[#007E8C]" />
  );
}

export function RecipientTable({
  recipients,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
  highlightedId,
  highlightRowRef,
  canEdit = false,
  savingId = null,
  onUpdateRecipient,
}: RecipientTableProps) {
  const save = (recipient: Recipient, updates: Partial<Recipient>) => {
    if (!canEdit || !onUpdateRecipient) return;
    onUpdateRecipient(recipient, updates);
  };

  // ── Column resize ──────────────────────────────────────────────────────
  // Pattern mirrors ScheduledSpreadsheetView: per-column width persisted to
  // localStorage, mouse-driven drag handle on the right edge of each header.
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [resizingColumn, setResizingColumn] = useState<
    { id: SortColumn; startX: number; startWidth: number } | null
  >(null);

  const getColumnWidth = (col: typeof COLUMNS[number]): number =>
    columnWidths[col.id] ?? col.defaultWidth;

  const handleResizeStart = (e: React.MouseEvent, col: typeof COLUMNS[number]) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn({
      id: col.id,
      startX: e.clientX,
      startWidth: getColumnWidth(col),
    });
  };

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingColumn.startX;
      const newWidth = Math.max(MIN_COLUMN_WIDTH_PX, resizingColumn.startWidth + deltaX);
      setColumnWidths((prev) => ({ ...prev, [resizingColumn.id]: newWidth }));
    };

    const handleUp = () => {
      // Persist using the latest state (functional update closes over latest).
      setColumnWidths((prev) => {
        try {
          localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(prev));
        } catch {
          // Quota or disabled storage — silently skip persistence.
        }
        return prev;
      });
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingColumn]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {canEdit && (
        <div className="px-3 py-2 bg-[#FBAD3F]/10 border-b border-[#FBAD3F]/20 text-sm text-slate-600">
          Click any cell to edit inline. Row click opens full details.
        </div>
      )}
      <div className="max-h-[calc(100vh-320px)] overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226,232,240)]">
            <TableRow className="hover:bg-slate-50">
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.id}
                  style={{ width: getColumnWidth(col), minWidth: MIN_COLUMN_WIDTH_PX }}
                  className={`relative whitespace-nowrap text-sm font-semibold text-slate-700 ${col.className || ''} ${
                    col.id === 'collectionDays'
                      ? 'bg-[#007E8C]/8'
                      : col.id === 'feedingDays'
                        ? 'bg-[#FBAD3F]/10'
                        : ''
                  } ${resizingColumn?.id === col.id ? 'select-none' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.id)}
                    className="inline-flex items-center gap-1 hover:text-[#007E8C] transition-colors"
                  >
                    {col.label}
                    <SortIcon column={col.id} sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                  {/* Resize handle — thin strip on the right edge. Stops
                      propagation so it doesn't trigger the sort button. */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${col.label} column`}
                    onMouseDown={(e) => handleResizeStart(e, col)}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#007E8C]/40 active:bg-[#007E8C]/60 transition-colors ${
                      resizingColumn?.id === col.id ? 'bg-[#007E8C]/60' : ''
                    }`}
                    title="Drag to resize column"
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.map((recipient) => {
              const isInactive = recipient.status === 'inactive';
              const isHighlighted = highlightedId === recipient.id;
              const isSaving = savingId === recipient.id;

              return (
                <TableRow
                  key={recipient.id}
                  ref={isHighlighted ? highlightRowRef : undefined}
                  onClick={() => onRowClick(recipient)}
                  className={`cursor-pointer transition-colors ${
                    isInactive ? 'bg-slate-50/80 text-slate-500 hover:bg-slate-100/80' : 'hover:bg-[#007E8C]/5'
                  } ${
                    isHighlighted
                      ? 'bg-[#FBAD3F]/10 ring-1 ring-inset ring-[#FBAD3F]/40'
                      : ''
                  }`}
                >
                  <TableCell className="font-medium">
                    <InlineTextCell
                      value={recipient.name || ''}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      className="text-sm text-[#236383] font-medium max-w-[180px]"
                      onSave={(name) => save(recipient, { name })}
                    />
                  </TableCell>
                  <TableCell className="bg-[#007E8C]/[0.03]">
                    <InlineScheduleCell
                      recipient={recipient}
                      variant="collection"
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell className="bg-[#FBAD3F]/[0.04]">
                    <InlineScheduleCell
                      recipient={recipient}
                      variant="feeding"
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineEstimatedSandwichesCell
                      recipient={recipient}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlinePeopleServedCell
                      recipient={recipient}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlinePeopleServedFrequencyCell
                      recipient={recipient}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineFruitOrSnacksCell
                      recipient={recipient}
                      variant="fruit"
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineFruitOrSnacksCell
                      recipient={recipient}
                      variant="snacks"
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineCadenceCell
                      recipient={recipient}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineTextCell
                      value={recipient.sandwichType || ''}
                      placeholder="—"
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(sandwichType) =>
                        save(recipient, { sandwichType: sandwichType || null })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <InlineTextCell
                      value={recipient.reportingGroup || ''}
                      placeholder="—"
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(reportingGroup) =>
                        save(recipient, { reportingGroup: reportingGroup || null })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <InlineTextCell
                      value={recipient.tspContact || ''}
                      placeholder="—"
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(tspContact) =>
                        save(recipient, { tspContact: tspContact || null })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <InlineFocusAreasCell
                      recipient={recipient}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 max-w-[120px] truncate">
                    {getRecipientRegion(recipient)}
                  </TableCell>
                  <TableCell>
                    <InlinePrimaryContactCell
                      recipient={recipient}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineContractCell
                      recipient={recipient}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineSurveyCell
                      recipient={recipient}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(updates) => save(recipient, updates)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
