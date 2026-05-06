import { Router } from "express";
import { selfRouter } from "./self-router.js";
import { assistantRouter } from "./assistant-router.js";
import { adminRouter } from "./admin-router.js";

export const usersRouter = Router();

usersRouter.use(selfRouter);
usersRouter.use(assistantRouter);
usersRouter.use(adminRouter);
