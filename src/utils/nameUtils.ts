/**
 * Utility functions for handling customer name operations
 */

export interface SplitName {
  firstName: string;
  lastName: string;
}

/**
 * Splits a full name into first and last name components for API compliance.
 *
 * @param fullName - The complete customer name to split
 * @returns Object containing firstName and lastName
 * @throws Error if the name is empty or contains only whitespace
 *
 * @example
 * splitCustomerName("John Doe") // { firstName: "John", lastName: "Doe" }
 * splitCustomerName("John Michael Smith") // { firstName: "John", lastName: "Michael Smith" }
 * splitCustomerName("Madonna") // { firstName: "Madonna", lastName: "Madonna" }
 */
export function splitCustomerName(fullName: string): SplitName {
  const trimmed = fullName.trim();

  if (!trimmed) {
    throw new Error("Customer name cannot be empty");
  }

  const nameParts = trimmed.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

  return {
    firstName,
    lastName
  };
}
