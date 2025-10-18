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
  
  return missing;
}
