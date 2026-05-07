import type React from 'react';
import { Edit, Trash2, Phone, Mail, MapPin, ToggleLeft, ToggleRight, Clock, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import TSPContactManager from '../tsp-contact-manager';
import { getRecipientDisplayRegion } from '@/lib/atlanta-regions';
import { normalizeFocusArea } from '@/lib/focus-area-groups';
import type { Recipient } from '@shared/schema';

interface RecipientCardProps {
  recipient: Recipient;
  canEdit: boolean;
  onEdit: (recipient: Recipient) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (recipient: Recipient) => void;
  highlighted?: boolean;
  highlightRef?: React.RefObject<HTMLDivElement>;
}

export function RecipientCard({ recipient, canEdit, onEdit, onDelete, onToggleStatus, highlighted, highlightRef }: RecipientCardProps) {
  const rawAreas = Array.isArray((recipient as any).focusAreas) && (recipient as any).focusAreas.length > 0
    ? (recipient as any).focusAreas
    : (recipient as any).focusArea ? [(recipient as any).focusArea] : [];
  const focusAreas = [...new Set(rawAreas.map((a) => normalizeFocusArea(a)).filter(Boolean))];

  return (
    <Card ref={highlightRef} className={`border transition-all duration-700 ${highlighted ? 'border-brand-primary ring-2 ring-brand-primary/40 shadow-lg shadow-brand-primary/20 bg-brand-primary-lighter/30' : 'border-slate-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{recipient.name}</CardTitle>
            {focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {focusAreas.map((area: string) => (
                  <Badge key={area} variant="outline" className="bg-brand-primary-lighter text-brand-primary border-brand-primary-border text-xs">
                    {area}
                  </Badge>
                ))}
              </div>
            )}
            <Badge variant={recipient.status === 'active' ? 'default' : 'secondary'}>
              {recipient.status}
            </Badge>

            {/* Schedule display — prominently below name */}
            {(() => {
              const collectionSchedules: Array<{ day: string; time: string; notes?: string }> =
                Array.isArray((recipient as any).collectionSchedules) && (recipient as any).collectionSchedules.length > 0
                  ? (recipient as any).collectionSchedules
                  : ((recipient as any).collectionDay || (recipient as any).collectionTime)
                    ? [{ day: (recipient as any).collectionDay || '', time: (recipient as any).collectionTime || '' }]
                    : [];

              const feedingSchedules: Array<{ day: string; time: string; notes?: string }> =
                Array.isArray((recipient as any).feedingSchedules) && (recipient as any).feedingSchedules.length > 0
                  ? (recipient as any).feedingSchedules
                  : ((recipient as any).feedingDay || (recipient as any).feedingTime)
                    ? [{ day: (recipient as any).feedingDay || '', time: (recipient as any).feedingTime || '' }]
                    : [];

              if (collectionSchedules.length === 0 && feedingSchedules.length === 0) return null;

              const formatSchedule = (entry: { day: string; time: string; notes?: string }) => {
                const parts = [entry.day, entry.time].filter(Boolean);
                const main = parts.length > 0 ? parts.join(' at ') : 'Not specified';
                return entry.notes ? `${main} (${entry.notes})` : main;
              };

              return (
                <div className="mt-2 space-y-1.5">
                  {collectionSchedules.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-blue-700">Collection:</span>{' '}
                        {collectionSchedules.map((s, i) => (
                          <span key={i} className="text-slate-600">
                            {i > 0 && <span className="text-slate-400"> · </span>}
                            {formatSchedule(s)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {feedingSchedules.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-green-700">Feeding:</span>{' '}
                        {feedingSchedules.map((s, i) => (
                          <span key={i} className="text-slate-600">
                            {i > 0 && <span className="text-slate-400"> · </span>}
                            {formatSchedule(s)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => onToggleStatus(recipient)}
                    className={recipient.status === 'active' ? 'text-green-600 hover:text-green-700' : 'text-gray-500 hover:text-gray-600'}
                  >
                    {recipient.status === 'active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {recipient.status === 'active' ? 'Mark as Inactive' : 'Mark as Active'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => onEdit(recipient)}>
              <Edit className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => onDelete(recipient.id)} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Phone className="w-4 h-4" />
          <span>{recipient.phone}</span>
        </div>
        {recipient.email && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail className="w-4 h-4" />
            <span>{recipient.email}</span>
          </div>
        )}
        {(recipient as any).website && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
            </svg>
            <a
              href={(recipient as any).website.startsWith('http') ? (recipient as any).website : `https://${(recipient as any).website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-primary underline"
            >
              {(recipient as any).website}
            </a>
          </div>
        )}
        {(recipient as any).instagramHandle && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            <a
              href={`https://instagram.com/${(recipient as any).instagramHandle.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-primary underline"
            >
              {(recipient as any).instagramHandle}
            </a>
          </div>
        )}
        {recipient.address && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="w-4 h-4" />
            <span>{recipient.address}</span>
          </div>
        )}
        {(() => {
          const displayRegion = getRecipientDisplayRegion(recipient);
          return displayRegion ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4" />
              <span className="font-medium">Region:</span> <span>{displayRegion}</span>
            </div>
          ) : null;
        })()}
        {recipient.preferences && (
          <div className="text-sm text-slate-600">
            <strong>Preferences:</strong> {recipient.preferences}
          </div>
        )}

        {/* Operational Information */}
        {(recipient.reportingGroup || (recipient as any).estimatedSandwiches || recipient.sandwichType || recipient.tspContact || recipient.contractSigned) && (
          <div className="border-t pt-3 mt-3">
            <div className="text-sm font-medium text-slate-700 mb-2">Operational Details</div>
            <div className="grid grid-cols-2 gap-2">
              {recipient.reportingGroup && (
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Reporting Group:</span> {recipient.reportingGroup}
                </div>
              )}
              {(recipient as any).estimatedSandwiches && (
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Estimated Sandwiches:</span> {(recipient as any).estimatedSandwiches}
                </div>
              )}
              {recipient.sandwichType && (
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Sandwich Type:</span> {recipient.sandwichType}
                </div>
              )}
              <div className="col-span-2 flex items-center gap-2">
                {recipient.contractSigned ? (
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                    Contract Signed
                    {recipient.contractSignedDate && ` (${new Date(recipient.contractSignedDate).toLocaleDateString()})`}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Contract Pending</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Social Media Tracking */}
        {(recipient as any).hasSharedPost && (
          <div className="border-t pt-3 mt-3">
            <div className="text-sm font-medium text-slate-700 mb-2">Social Media Engagement</div>
            <Badge variant="default" className="text-xs bg-purple-100 text-purple-800">
              Shared Post
              {(recipient as any).sharedPostDate && ` (${new Date((recipient as any).sharedPostDate).toLocaleDateString()})`}
            </Badge>
          </div>
        )}

        {/* Recipient Survey */}
        {(recipient as any).surveySubmitted && (
          <div className="border-t pt-3 mt-3">
            <div className="text-sm font-medium text-slate-700 mb-2">Recipient Survey</div>
            <Badge variant="default" className="text-xs bg-[#47B3CB]/15 text-[#236383] border border-[#47B3CB]/40">
              Survey submitted
              {(recipient as any).surveySubmittedDate && ` (${new Date((recipient as any).surveySubmittedDate).toLocaleDateString()})`}
            </Badge>
          </div>
        )}

        {/* Contact Person Information */}
        {(recipient.contactPersonName || recipient.contactPersonPhone || recipient.contactPersonEmail) && (
          <div className="border-t pt-3 mt-3">
            <div className="text-sm font-medium text-slate-700 mb-2">Contact Person</div>
            {recipient.contactPersonName && (
              <div className="text-sm text-slate-600 flex items-center gap-2">
                <span className="font-medium">Name:</span>
                <span>{recipient.contactPersonName}</span>
                {recipient.contactPersonRole && <Badge variant="outline" className="text-xs">{recipient.contactPersonRole}</Badge>}
              </div>
            )}
            {recipient.contactPersonPhone && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                <Phone className="w-4 h-4" />
                <span>{recipient.contactPersonPhone}</span>
              </div>
            )}
            {recipient.contactPersonEmail && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                <Mail className="w-4 h-4" />
                <span>{recipient.contactPersonEmail}</span>
              </div>
            )}
          </div>
        )}

        {/* Second Contact Person Information */}
        {((recipient as any).secondContactPersonName || (recipient as any).secondContactPersonPhone || (recipient as any).secondContactPersonEmail) && (
          <div className="border-t pt-3 mt-3">
            <div className="text-sm font-medium text-slate-700 mb-2">Second Contact Person</div>
            {(recipient as any).secondContactPersonName && (
              <div className="text-sm text-slate-600 flex items-center gap-2">
                <span className="font-medium">Name:</span>
                <span>{(recipient as any).secondContactPersonName}</span>
                {(recipient as any).secondContactPersonRole && <Badge variant="outline" className="text-xs">{(recipient as any).secondContactPersonRole}</Badge>}
              </div>
            )}
            {(recipient as any).secondContactPersonPhone && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                <Phone className="w-4 h-4" />
                <span>{(recipient as any).secondContactPersonPhone}</span>
              </div>
            )}
            {(recipient as any).secondContactPersonEmail && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                <Mail className="w-4 h-4" />
                <span>{(recipient as any).secondContactPersonEmail}</span>
              </div>
            )}
          </div>
        )}

        {/* TSP Contacts */}
        <TSPContactManager recipientId={recipient.id} recipientName={recipient.name} compact={true} />
      </CardContent>
    </Card>
  );
}
