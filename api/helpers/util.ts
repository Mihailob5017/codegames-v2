export const timestamp = (dateOnly: boolean = false): Date => {
	if (dateOnly) {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), now.getDate());
	}
	return new Date();
};
