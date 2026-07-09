/**
 * Instructions Section
 *
 * Handles driver and volunteer instructions that get
 * included in reminder notifications. (Speaker role retired.)
 */
import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EventFormData } from './types';

interface InstructionsSectionProps {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export const InstructionsSection: React.FC<InstructionsSectionProps> = ({
  formData,
  setFormData,
}) => {
  return (
    <div className="space-y-4 border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="flex items-center gap-3 pb-2 border-b border-purple-200">
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        <span className="text-lg font-semibold text-purple-800">Event Instructions for Volunteers</span>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Sent in reminder texts/emails</span>
      </div>
      <p className="text-sm text-purple-700">
        These instructions will be automatically included in reminder notifications sent to assigned drivers and volunteers before the event.
      </p>

      {/* Driver Instructions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Label htmlFor="driverInstructions" className="text-purple-800 font-medium">Driver Instructions</Label>
        </div>
        <Textarea
          id="driverInstructions"
          value={formData.driverInstructions || ''}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, driverInstructions: e.target.value }))}
          placeholder="Special instructions for drivers (e.g., parking location, entrance to use, who to ask for, delivery notes)"
          className="min-h-[80px] border-purple-200 focus:border-purple-400"
          data-testid="textarea-driver-instructions"
        />
      </div>

      {/* Volunteer Instructions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Label htmlFor="volunteerInstructions" className="text-purple-800 font-medium">Volunteer Instructions</Label>
        </div>
        <Textarea
          id="volunteerInstructions"
          value={formData.volunteerInstructions || ''}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, volunteerInstructions: e.target.value }))}
          placeholder="Special instructions for general volunteers (e.g., what to bring, where to meet, tasks to help with)"
          className="min-h-[80px] border-purple-200 focus:border-purple-400"
          data-testid="textarea-volunteer-instructions"
        />
      </div>

    </div>
  );
};
