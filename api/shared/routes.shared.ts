import { API_ROUTE } from "../helpers/contants.ts";

// TODO[maybe]: Add a env secret to an admin route for enhanced security, and a login for the admin dashboard if I decide to build it
export const adminRoutes = {
	baseURL: `${API_ROUTE}/admin`,
	healthCheck: `${API_ROUTE}/admin/health-check`,
	users: `${API_ROUTE}/admin/users`,
	userById: `${API_ROUTE}/admin/users/:id`,
	// Add more admin routes here as needed
};
