/**
 * Delivery Section
 *
 * Handles event address, overnight holding, and delivery destination selection.
 */
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MultiRecipientSelector } from '@/components/ui/multi-recipient-selector';
import type { EventFormData } from './types';

interface DeliverySectionProps {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export const DeliverySection: React.FC<DeliverySectionProps> = ({
  formData,
  setFormData,
}) => {
  return (
    <>
      {/* Address */}
      <div>
        <Label htmlFor="eventAddress">Event Address</Label>
        <Input
          id="eventAddress"
          value={formData.eventAddress}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, eventAddress: e.target.value }))}
          placeholder="Enter the event location address"
        />
      </div>

      {/* Delivery Destinations */}
      <div className="space-y-4">
        <div className="p-3 bg-brand-primary-lighter border border-brand-primary-border rounded-lg">
          <p className="text-sm text-brand-primary mb-2 font-medium">
            Delivery Options: You can specify either a direct delivery destination, or an overnight holding location with a final destination.
          </p>
        </div>

        {/* Overnight Holding Checkbox */}
        <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <input
            type="checkbox"
            id="holdingOvernight"
            checked={formData.holdingOvernight}
            onChange={(e) => {
              const checked = e.target.checked;
              setFormData((prev: any) => ({
                ...prev,
                holdingOvernight: checked,
                ...(checked ? {} : {
                  overnightHoldingLocation: '',
                  overnightPickupTime: '',
                  deliveryTimeWindow: '',
                  deliveryParkingAccess: ''
                })
              }));
            }}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            data-testid="checkbox-holding-overnight"
          />
          <Label htmlFor="holdingOvernight" className="text-sm font-medium text-blue-900 cursor-pointer">
            This group will hold sandwiches overnight
          </Label>
        </div>

        {/* Overnight Holding Location */}
        {formData.holdingOvernight && (
          <div className="space-y-2">
            <Label htmlFor="overnightHoldingLocation">Overnight Holding Location</Label>
            <Input
              id="overnightHoldingLocation"
              value={formData.overnightHoldingLocation}
              onChange={(e) => setFormData((prev: any) => ({ ...prev, overnightHoldingLocation: e.target.value }))}
              placeholder="Location where sandwiches will be stored overnight (e.g., church, community center)"
              data-testid="input-overnight-location"
            />
            {formData.overnightHoldingLocation && (
              <div className="ml-4 mt-2 space-y-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-900">Next-Day Delivery Details</h4>
                <div>
                  <Label htmlFor="overnightPickupTime">Pickup Time from Overnight Location</Label>
                  <Input
                    id="overnightPickupTime"
                    type="time"
                    value={formData.overnightPickupTime}
                    onChange={(e) => setFormData((prev: any) => ({ ...prev, overnightPickupTime: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="deliveryTimeWindow">Delivery Time Window</Label>
                  <Input
                    id="deliveryTimeWindow"
                    type="text"
                    value={formData.deliveryTimeWindow || ''}
                    onChange={(e) => setFormData((prev: any) => ({ ...prev, deliveryTimeWindow: e.target.value }))}
                    placeholder="e.g., 11:00 AM - 12:00 PM"
                  />
                </div>
                <div>
                  <Label htmlFor="deliveryParkingAccess">Parking/Access Details</Label>
                  <Textarea
                    id="deliveryParkingAccess"
                    value={formData.deliveryParkingAccess || ''}
                    onChange={(e) => setFormData((prev: any) => ({ ...prev, deliveryParkingAccess: e.target.value }))}
                    placeholder="e.g., Park in rear lot, use loading dock entrance"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final Delivery Destination - Multiple Recipients */}
        <div>
          <Label htmlFor="deliveryDestination">
            {formData.overnightHoldingLocation ? 'Final Delivery Destinations' : 'Delivery Destinations'}
          </Label>
          <p className="text-sm text-gray-500 mb-2">
            Select one or more recipient organizations where the sandwiches will be delivered
          </p>
          <MultiRecipientSelector
            value={formData.assignedRecipientIds}
            onChange={(ids) => setFormData((prev: any) => ({ ...prev, assignedRecipientIds: ids }))}
            placeholder={formData.overnightHoldingLocation
              ? "Select recipient organizations for final delivery..."
              : "Select recipient organizations..."}
            data-testid="delivery-destination-multi-selector"
          />
        </div>
      </div>
    </>
  );
};
