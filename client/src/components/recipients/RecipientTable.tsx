import type React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Recipient } from '@shared/schema';
import { ScheduleDayChips } from './ScheduleDayChips';
import {
  getCollectionSchedules,
  getFeedingSchedules,
  getFocusAreas,
  getRecipientRegion,
  getEstimatedSandwiches,
  getContractStatus,
  getPrimaryContactName,
  type SortColumn,
  type SortDirection,
} from './recipient-schedule-utils';

const COLUMNS: { id: SortColumn; label: string; className?: string }[] = [
  { id: 'name', label: 'Name', className: 'min-w-[160px]' },
  { id: 'status', label: 'Status', className: 'w-[90px]' },
  { id: 'focusArea', label: 'Focus Area', className: 'min-w-[140px]' },
  { id: 'region', label: 'Region', className: 'min-w-[120px]' },
  { id: 'collectionDays', label: 'Collection Days', className: 'min-w-[130px]' },
  { id: 'feedingDays', label: 'Feeding Days', className: 'min-w-[120px]' },
  { id: 'estimatedSandwiches', label: 'Est. Sandwiches', className: 'w-[110px]' },
  { id: 'sandwichType', label: 'Sandwich Type', className: 'w-[110px]' },
  { id: 'primaryContact', label: 'Primary Contact', className: 'min-w-[160px]' },
  { id: 'tspContact', label: 'TSP Contact', className: 'min-w-[120px]' },
  { id: 'contract', label: 'Contract', className: 'w-[100px]' },
  { id: 'reportingGroup', label: 'Reporting Group', className: 'min-w-[120px]' },
];

interface RecipientTableProps {
  recipients: Recipient[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  onRowClick: (recipient: Recipient) => void;
  highlightedId?: number;
  highlightRowRef?: React.RefObject<HTMLTableRowElement>;
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

function ContractBadge({ recipient }: { recipient: Recipient }) {
  const status = getContractStatus(recipient);
  if (status === 'signed') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs cursor-default">
            Signed
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {recipient.contractSignedDate
            ? `Signed ${new Date(recipient.contractSignedDate).toLocaleDateString()}`
            : 'Contract signed'}
        </TooltipContent>
      </Tooltip>
    );
  }
  if (status === 'pending') {
    return (
      <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-800 border-amber-200">
        Pending
      </Badge>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

function PrimaryContactCell({ recipient }: { recipient: Recipient }) {
  const name = getPrimaryContactName(recipient);
  const phone = recipient.contactPersonPhone || recipient.phone;
  const email = recipient.contactPersonEmail || recipient.email;

  if (!name && !phone && !email) {
    return <span className="text-xs text-slate-400 italic">—</span>;
  }

  return (
    <div className="space-y-0.5">
      {name && <div className="text-xs font-medium text-slate-800 truncate">{name}</div>}
      {phone && <div className="text-[11px] text-slate-500 truncate">{phone}</div>}
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center text-[#007E8C] hover:text-[#236383]"
          title={email}
        >
          <Mail className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
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
}: RecipientTableProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="max-h-[calc(100vh-320px)] overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226,232,240)]">
            <TableRow className="hover:bg-slate-50">
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.id}
                  className={`whitespace-nowrap text-xs font-semibold text-slate-700 ${col.className || ''} ${
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
              const focusAreas = getFocusAreas(recipient);
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick(recipient);
                      }}
                      className="text-left text-sm text-[#236383] hover:text-[#007E8C] hover:underline truncate max-w-[180px] block"
                    >
                      {recipient.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={recipient.status === 'active' ? 'default' : 'secondary'}
                      className={`text-[10px] ${isInactive ? 'opacity-70' : ''}`}
                    >
                      {recipient.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                      {focusAreas.length > 0 ? (
                        focusAreas.map((area) => (
                          <Badge
                            key={area}
                            variant="outline"
                            className="text-[10px] bg-brand-primary-lighter/50 text-brand-primary border-brand-primary-border px-1.5 py-0"
                          >
                            {area}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-[120px] truncate">
                    {getRecipientRegion(recipient)}
                  </TableCell>
                  <TableCell className="bg-[#007E8C]/[0.03]">
                    <ScheduleDayChips
                      schedules={getCollectionSchedules(recipient)}
                      variant="collection"
                    />
                  </TableCell>
                  <TableCell className="bg-[#FBAD3F]/[0.04]">
                    <ScheduleDayChips
                      schedules={getFeedingSchedules(recipient)}
                      variant="feeding"
                    />
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 tabular-nums">
                    {estimate != null ? estimate.toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {recipient.sandwichType || '—'}
                  </TableCell>
                  <TableCell>
                    <PrimaryContactCell recipient={recipient} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-[140px] truncate">
                    {recipient.tspContact || '—'}
                  </TableCell>
                  <TableCell>
                    <ContractBadge recipient={recipient} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-[120px] truncate">
                    {recipient.reportingGroup || '—'}
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
