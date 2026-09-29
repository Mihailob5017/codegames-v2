import { API_ROUTE } from "../helpers/contants.ts";

// TODO[maybe]: Add a env secret to an admin route for enhanced security, and a login for the admin dashboard if I decide to build it
export const adminRoutes = {
	baseURL: `${API_ROUTE}/admin`,
	healthCheck: `${API_ROUTE}/admin/health-check`,
	getUsers: `${API_ROUTE}/admin/users`,
	getUserById: `${API_ROUTE}/admin/users/:id`,
	createUser: `${API_ROUTE}/admin/create-user`,
	// Add more admin routes here as needed
};
