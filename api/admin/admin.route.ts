import { Router } from "express";
import { healthCheck, createUser } from "./admin.controller.ts";
import { adminRoutes } from "../shared/routes.shared.ts";

const router = Router();

router.get(adminRoutes.healthCheck, healthCheck);

router.post(adminRoutes.createUser, createUser);

export default router;
