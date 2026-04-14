import { Router } from "express";
import auth from "../middleware/auth.js";

import pathRoutes from "./training/path.js";
import modulesRoutes from "./training/modules.js";
import examsRoutes from "./training/exams.js";
import practiceRoutes from "./training/practice.js";
import readinessRoutes from "./training/readiness.js";
import srRoutes from "./training/sr.js";
import questionsRoutes from "./training/questions.js";
import answersRoutes from "./training/answers.js";

const router = Router();

// All training routes require auth
router.use(auth);

// Mount sub-routes
router.use(pathRoutes);
router.use(modulesRoutes);
router.use(examsRoutes);
router.use(practiceRoutes);
router.use(readinessRoutes);
router.use(srRoutes);
router.use(questionsRoutes);
router.use(answersRoutes);

export default router;
