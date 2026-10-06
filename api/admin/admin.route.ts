import { Router } from "express";
import {
	healthCheck,
	createUser,
	deleteUser,
	getAllUsers,
	getUser,
} from "./admin.controller.ts";
import { adminRoutes } from "../shared/routes.shared.ts";

const router = Router();

router.get(adminRoutes.healthCheck, healthCheck);

router.post(adminRoutes.users, createUser);

router.get(adminRoutes.users, getAllUsers);

router.get(adminRoutes.userById, getUser);

router.delete(adminRoutes.userById, deleteUser);

export default router;
