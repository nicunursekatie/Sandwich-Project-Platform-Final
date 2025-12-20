import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Phone,
  CheckCircle2,
  Circle,
  AlertCircle,
  MapPin,
  Calendar,
  Users,
  Package,
  Refrigerator,
  UtensilsCrossed,
  Car,
  UserCheck,
  FileText,
  Clock,
} from 'lucide-react';
import type { EventRequest } from '@shared/schema';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IntakeCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onCallComplete?: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  required?: boolean;
  notes?: string;
}

const OPERATING_AREAS = [
  'Dunwoody',
  'Sandy Springs',
  'Intown (generally not South Atlanta)',
  'Buckhead',
  'Peachtree Corners',
  'Alpharetta',
  'Milton',
  'Dacula',
  'Marietta',
  'Roswell',
];

const IntakeCallDialog: React.FC<IntakeCallDialogProps> = ({
  isOpen,
  onClose,
  eventRequest,
  onCallComplete,
}) => {
  const isMobile = useIsMobile();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleItem = (itemId: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleCall = () => {
    if (!eventRequest?.phone) return;

    if (isMobile) {
      window.location.href = `tel:${eventRequest.phone}`;
    } else {
      navigator.clipboard.writeText(eventRequest.phone || '').then(() => {
        window.alert(`Phone number copied!\n${eventRequest.phone} has been copied to your clipboard.`);
      });
    }
  };

  const handleComplete = () => {
    onCallComplete?.();
    setCheckedItems(new Set());
    onClose();
  };

  if (!eventRequest) return null;

  const checklistItems: ChecklistItem[] = [
    // Initial Questions
    {
      id: 'how_heard',
      label: 'How did they hear about us?',
      category: 'Initial Questions',
      required: true,
    },
    {
      id: 'confirm_date',
      label: 'Confirm date submitted is the date they want',
      category: 'Initial Questions',
      required: true,
    },
    {
      id: 'confirm_time',
      label: 'Confirm event time (if not provided, get ASAP)',
      category: 'Initial Questions',
      required: true,
      notes: 'Drivers are volunteers - need heads up to plan',
    },

    // Location & Area Check
    {
      id: 'get_address',
      label: 'Get/confirm event address',
      category: 'Location & Area',
      required: true,
    },
    {
      id: 'check_area',
      label: 'Check if in operating area',
      category: 'Location & Area',
      required: true,
      notes: `Typical areas: ${OPERATING_AREAS.join(', ')}`,
    },
    {
      id: 'confirm_transport',
      label: 'Confirm transport feasibility to typical recipients',
      category: 'Location & Area',
      required: true,
      notes: 'Only if in typical vicinity',
    },
    {
      id: 'outside_area',
      label: 'If outside area: collect info, check with team',
      category: 'Location & Area',
      notes: 'Let them know we need to check with team',
    },

    // Refrigeration & Sandwich Type
    {
      id: 'refrigeration',
      label: 'Do they have refrigeration available?',
      category: 'Refrigeration & Type',
      required: true,
    },
    {
      id: 'confirm_deli',
      label: 'If no fridge: only PBJ option (mention only if they want PBJ or no fridge)',
      category: 'Refrigeration & Type',
      notes: "Don't mention PBJ unless they want it or have no fridge",
    },
    {
      id: 'school_pbj',
      label: 'If school: confirm making deli (no PBJ for schools due to allergy risk)',
      category: 'Refrigeration & Type',
      notes: 'Students making PBJ often make messy sandwiches',
    },

    // Event Details Collection
    {
      id: 'contact_name',
      label: 'Contact person name',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'contact_phone',
      label: 'Contact phone number',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'contact_email',
      label: 'Contact email',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'event_address',
      label: 'Event address',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'event_date',
      label: 'Event date',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'event_time',
      label: 'Event time',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'participant_count',
      label: 'Approximate number of people',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'sandwich_count',
      label: 'Number of sandwiches',
      category: 'Event Details',
      required: true,
      notes: 'If they say 200, ask how many people and time available - see if they can make more',
    },
    {
      id: 'sandwich_type',
      label: 'Type of sandwiches',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'speaker_needed',
      label: 'Do they want a speaker?',
      category: 'Event Details',
      notes: 'Prefer to send for >500 sandwiches, but will send for others when possible, especially corporate',
    },
    {
      id: 'additional_volunteers',
      label: 'Additional volunteers needed?',
      category: 'Event Details',
      notes: 'For larger events',
    },

    // Food Safety & Logistics
    {
      id: 'review_toolkit',
      label: 'Review toolkit (food safety, setup, supplies)',
      category: 'Food Safety & Logistics',
      required: true,
    },
    {
      id: 'food_safe_gloves',
      label: 'Include food safe gloves, tablecloths, etc.',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'meat_cheese_refrigeration',
      label: 'Meat and cheese must be refrigerated until used',
      category: 'Food Safety & Logistics',
      notes: 'Only take out what is needed. Once made and packed back into bread bag, put back in fridge',
    },
    {
      id: 'discuss_shopping',
      label: 'Discuss shopping: coolers, deli meat & cheese storage, bread',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'transport_meat_cheese',
      label: 'When transporting: meat/cheese on ice packs in cooler',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'buying_supplies',
      label: 'Meat/cheese bought just before event, remain unopened until making',
      category: 'Food Safety & Logistics',
      notes: 'One person who reviewed food safety protocols should buy supplies. Others should not bring ingredients',
    },
    {
      id: 'cooling_sandwiches',
      label: 'Last sandwiches in freezer to cool OR pickup 30+ min after making',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'parking_access',
      label: 'Information for TSP volunteer: parking or building access?',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'backup_contact',
      label: 'Back-up contact? (Name and number)',
      category: 'Food Safety & Logistics',
    },

    // Process Discussion
    {
      id: 'discuss_process',
      label: 'Discuss how groups make sandwiches',
      category: 'Process Discussion',
      notes: 'Have them open PDF: Two slices bread, two slices cheese, two to three slices turkey',
    },
    {
      id: 'assembly_line',
      label: 'Discuss teams making sandwiches in assembly line',
      category: 'Process Discussion',
    },
    {
      id: 'runner_role',
      label: 'Discuss having a runner (gets meat/cheese out, puts sandwiches back)',
      category: 'Process Discussion',
    },
    {
      id: 'typical_rules',
      label: 'Discuss typical event rules: runner needed, food safety (hair tied back, gloves, tablecloths), someone to snap photos',
      category: 'Process Discussion',
    },
  ];

  const itemsByCategory = checklistItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const requiredCount = checklistItems.filter((item) => item.required).length;
  const checkedRequiredCount = checklistItems.filter(
    (item) => item.required && checkedItems.has(item.id)
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl text-[#236383]">
                <Phone className="w-6 h-6" />
                Intake Call Guide
              </DialogTitle>
              <DialogDescription className="mt-2 text-base">
                {eventRequest.organizationName} • {eventRequest.firstName}{' '}
                {eventRequest.lastName}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-sm px-3 py-1"
                style={{ borderColor: '#007E8C', color: '#007E8C' }}
              >
                {checkedRequiredCount}/{requiredCount} Required
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCall}
                className="flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                {isMobile ? 'Call' : 'Copy Number'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Quick Info Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-[#236383] mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Quick Reference
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {eventRequest.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Phone:</span>
                    <span>{eventRequest.phone}</span>
                  </div>
                )}
                {eventRequest.email && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Email:</span>
                    <span className="truncate">{eventRequest.email}</span>
                  </div>
                )}
                {eventRequest.eventAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Address:</span>
                    <span className="truncate">{eventRequest.eventAddress}</span>
                  </div>
                )}
                {(eventRequest.desiredEventDate || eventRequest.scheduledEventDate) && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Date:</span>
                    <span>
                      {eventRequest.scheduledEventDate
                        ? new Date(eventRequest.scheduledEventDate).toLocaleDateString()
                        : eventRequest.desiredEventDate
                        ? new Date(eventRequest.desiredEventDate).toLocaleDateString()
                        : 'Not set'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Checklist by Category */}
            {Object.entries(itemsByCategory).map(([category, items]) => (
              <div key={category} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-[#236383] mb-3 text-lg flex items-center gap-2">
                  {category === 'Initial Questions' && <Clock className="w-5 h-5" />}
                  {category === 'Location & Area' && <MapPin className="w-5 h-5" />}
                  {category === 'Refrigeration & Type' && <Refrigerator className="w-5 h-5" />}
                  {category === 'Event Details' && <FileText className="w-5 h-5" />}
                  {category === 'Food Safety & Logistics' && <UtensilsCrossed className="w-5 h-5" />}
                  {category === 'Process Discussion' && <Users className="w-5 h-5" />}
                  {category}
                </h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-2 rounded-md transition-colors ${
                        checkedItems.has(item.id)
                          ? 'bg-green-50 border border-green-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="mt-0.5 flex-shrink-0"
                        aria-label={`Toggle ${item.label}`}
                      >
                        {checkedItems.has(item.id) ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <label
                            className={`text-sm cursor-pointer flex-1 ${
                              checkedItems.has(item.id)
                                ? 'text-gray-600 line-through'
                                : 'text-gray-900'
                            }`}
                            onClick={() => toggleItem(item.id)}
                          >
                            {item.label}
                            {item.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-1 ml-7 italic">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Operating Areas Reference */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-[#236383] mb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Typical Operating Areas
              </h3>
              <p className="text-sm text-gray-700 mb-2">
                If event is in these areas, confirm transport feasibility:
              </p>
              <div className="flex flex-wrap gap-2">
                {OPERATING_AREAS.map((area) => (
                  <Badge
                    key={area}
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: '#FBAD3F', color: '#D68319' }}
                  >
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0 bg-gray-50">
          <div className="text-sm text-gray-600">
            {checkedRequiredCount === requiredCount ? (
              <span className="text-green-600 font-medium">
                ✓ All required items completed
              </span>
            ) : (
              <span>
                Complete {requiredCount - checkedRequiredCount} more required item
                {requiredCount - checkedRequiredCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleComplete}
              className="bg-[#007E8C] hover:bg-[#236383] text-white"
            >
              Mark Call Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IntakeCallDialog;
