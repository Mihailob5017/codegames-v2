export const schemaErrors = {
	lessThan: (field: string, value: number) =>
		`${field} must be less than ${value}`,
	greaterThan: (field: string, value: number) =>
		`${field} must be greater than ${value}`,
	length: (field: string, min: number, max: number) =>
		`${field} must be between ${min} and ${max} characters`,
	mustContain: (field: string, value: string) =>
		`${field} must contain ${value}`,
	mustBeType: (field: string, type: string) => `${field} must be a ${type}`,
};
