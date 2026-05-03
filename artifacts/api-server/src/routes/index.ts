import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import membersRouter from "./members";
import plansRouter from "./plans";
import membershipsRouter from "./memberships";
import billingRouter from "./billing";
import accessRouter from "./access";
import classesRouter from "./classes";
import staffRouter from "./staff";
import storeRouter from "./store";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";
import loyaltyRouter from "./loyalty";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(membersRouter);
router.use(plansRouter);
router.use(membershipsRouter);
router.use(billingRouter);
router.use(accessRouter);
router.use(classesRouter);
router.use(staffRouter);
router.use(storeRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);
router.use(settingsRouter);
router.use(loyaltyRouter);
router.use(uploadsRouter);

export default router;
