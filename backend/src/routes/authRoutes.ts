import { Router } from "express";
import { register, login, getMe } from "../controllers/authController";
import { updateProfile } from "../controllers/userController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticateToken, getMe);
router.put("/me", authenticateToken, updateProfile);

export default router;