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
  
  // Check for sandwich count - this is the critical info we need
  const hasSandwichCount = 
    (request.estimatedSandwichCount && request.estimatedSandwichCount > 0) ||
    (request.estimatedSandwichCountMin && request.estimatedSandwichCountMin > 0) ||
    (request.estimatedSandwichCountMax && request.estimatedSandwichCountMax > 0);
  
  if (!hasSandwichCount) {
    missing.push('Sandwich Info');
  }
  
  // Check for address (event address, delivery destination, or overnight holding location)
  // Skip address requirement if organization is delivering themselves (no drivers/van driver needed)
  const organizationDelivering = 
    (!request.driversNeeded || request.driversNeeded === 0) && 
    !request.vanDriverNeeded;
  
  if (!organizationDelivering) {
    const hasAddress = 
      (request.eventAddress && request.eventAddress.trim() !== '') ||
      (request.deliveryDestination && request.deliveryDestination.trim() !== '') ||
      (request.overnightHoldingLocation && request.overnightHoldingLocation.trim() !== '');
    
    if (!hasAddress) {
      missing.push('Address');
    }
  }

  // Conditional field validation: If speakers needed, check for event start time
  if (request.speakersNeeded && request.speakersNeeded > 0) {
    if (!request.eventStartTime) {
      missing.push('Event Start Time');
    }
    // Note: speakerAudienceType and speakerDuration are planning details filled in later,
    // not critical intake information
  }

  return missing;
}
