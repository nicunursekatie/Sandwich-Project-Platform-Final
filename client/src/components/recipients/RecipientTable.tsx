import type React from 'react';
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
  getEstimatedSandwiches,
  type SortColumn,
  type SortDirection,
} from './recipient-schedule-utils';
import {
  InlineTextCell,
  InlineNumberCell,
  InlineContractCell,
  InlineScheduleCell,
  InlineFocusAreasCell,
  InlinePrimaryContactCell,
} from './recipient-table-inline-cells';

const COLUMNS: { id: SortColumn; label: string; className?: string }[] = [
  { id: 'name', label: 'Name', className: 'min-w-[160px]' },
  { id: 'collectionDays', label: 'Collection Days', className: 'min-w-[130px]' },
  { id: 'feedingDays', label: 'Feeding Days', className: 'min-w-[120px]' },
  { id: 'estimatedSandwiches', label: 'Est. Sandwiches', className: 'w-[110px]' },
  { id: 'sandwichType', label: 'Sandwich Type', className: 'w-[110px]' },
  { id: 'reportingGroup', label: 'Reporting Group', className: 'min-w-[120px]' },
  { id: 'tspContact', label: 'TSP Contact', className: 'min-w-[120px]' },
  { id: 'focusArea', label: 'Focus Area', className: 'min-w-[140px]' },
  { id: 'region', label: 'Region', className: 'min-w-[120px]' },
  { id: 'primaryContact', label: 'Primary Contact', className: 'min-w-[160px]' },
  { id: 'contract', label: 'Contract', className: 'w-[100px]' },
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
                  className={`whitespace-nowrap text-sm font-semibold text-slate-700 ${col.className || ''} ${
                    col.id === 'collectionDays'
                      ? 'bg-[#007E8C]/8'
                      : col.id === 'feedingDays'
                        ? 'bg-[#FBAD3F]/10'
                        : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.id)}
                    className="inline-flex items-center gap-1 hover:text-[#007E8C] transition-colors"
                  >
                    {col.label}
                    <SortIcon column={col.id} sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.map((recipient) => {
              const isInactive = recipient.status === 'inactive';
              const isHighlighted = highlightedId === recipient.id;
              const isSaving = savingId === recipient.id;
              const estimate = getEstimatedSandwiches(recipient);

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
                    <InlineNumberCell
                      value={estimate}
                      canEdit={canEdit}
                      isSaving={isSaving}
                      onSave={(val) =>
                        save(recipient, {
                          weeklyEstimate: val,
                          estimatedSandwiches: val,
                        })
                      }
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
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
