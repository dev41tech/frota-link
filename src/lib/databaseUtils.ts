// Utility functions for handling UUIDs and database operations

/**
 * Safely converts a value to a UUID or null
 * Prevents empty strings from being passed as UUIDs
 */
export function toUuidOrNull(value: string | null | undefined): string | null {
  if (!value || value.trim() === '') {
    return null;
  }
  return value;
}

/**
 * Safely converts a value to ensure it's not undefined for database operations
 */
export function toNullIfUndefined<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

/**
 * Validates that a UUID is properly formatted
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Prepares data for database insertion by cleaning UUID fields
 */
export function cleanDataForInsert(data: Record<string, any>): Record<string, any> {
  const cleaned = { ...data };
  
  // Common UUID fields that need cleaning
  const uuidFields = ['company_id', 'user_id', 'journey_id', 'vehicle_id', 'driver_id'];
  
  uuidFields.forEach(field => {
    if (field in cleaned) {
      cleaned[field] = toUuidOrNull(cleaned[field]);
    }
  });

  // Convert undefined values to null
  Object.keys(cleaned).forEach(key => {
    cleaned[key] = toNullIfUndefined(cleaned[key]);
  });

  return cleaned;
}