import type { EventRequest } from '@shared/schema';

/**
 * Validates event request intake information and returns list of missing critical data
 * Checks all canonical fields including contact info, sandwich details, and addresses
 */
export function getMissingIntakeInfo(request: EventRequest): string[] {
  const missing: string[] = [];
  
  // Check for contact info (email OR phone)
  const hasContactInfo = request.email || request.phone;
  
  if (!hasContactInfo) {
    missing.push('Contact Info');
  }
  
  // Check for sandwich estimate (check all possible sources including structured data)
  const hasSandwichCount = 
    (request.estimatedSandwichCount && request.estimatedSandwichCount > 0) ||
    (request.estimatedSandwichCountMin && request.estimatedSandwichCountMin > 0) ||
    (request.estimatedSandwichCountMax && request.estimatedSandwichCountMax > 0);
  
  // Check sandwich types in sandwichTypes array or structured sandwich details
  const hasSandwichTypes = 
    (request.sandwichTypes && 
      ((Array.isArray(request.sandwichTypes) && request.sandwichTypes.length > 0) ||
       (typeof request.sandwichTypes === 'object' && !Array.isArray(request.sandwichTypes) && Object.keys(request.sandwichTypes).length > 0)));
  
  if (!hasSandwichCount || !hasSandwichTypes) {
    missing.push('Sandwich Info');
  }
  
  // Check for address (event address, delivery destination, or overnight holding location)
  const hasAddress = 
    (request.eventAddress && request.eventAddress.trim() !== '') ||
    (request.deliveryDestination && request.deliveryDestination.trim() !== '') ||
    (request.overnightHoldingLocation && request.overnightHoldingLocation.trim() !== '');
  
  if (!hasAddress) {
    missing.push('Address');
  }

  // Conditional field validation: If drivers needed, check for pickup details
  if (request.driversNeeded && request.driversNeeded > 0) {
    if (!request.pickupTimeWindow) {
      missing.push('Pickup Time Window');
    }
    if (!request.pickupPersonResponsible) {
      missing.push('Pickup Contact Person');
    }
  }

  // Conditional field validation: If speakers needed, check for speaker details
  if (request.speakersNeeded && request.speakersNeeded > 0) {
    if (!request.eventStartTime) {
      missing.push('Event Start Time');
    }
    if (!request.speakerAudienceType) {
      missing.push('Speaker Audience Type');
    }
    if (!request.speakerDuration) {
      missing.push('Speaker Duration');
    }
  }

  // Conditional field validation: If overnight holding is set, check for delivery details
  if (request.overnightHoldingLocation && request.overnightHoldingLocation.trim() !== '') {
    if (!request.deliveryTimeWindow) {
      missing.push('Delivery Time Window');
    }
    if (!request.deliveryParkingAccess) {
      missing.push('Delivery Parking/Access Info');
    }
  }

  return missing;
}
