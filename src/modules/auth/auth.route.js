import express from "express";
import passport from "passport";
import { createToken } from "../../utils/jwt.js";

const router = express.Router();

// login google
router.get("/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

// callback
router.get("/google/callback",
    passport.authenticate("google", { session: false }),
    (req, res) => {
        const token = createToken(req.user);

        return res.redirect(`http://localhost:3000/login-success?token=${token}`);
    }
);

export default router;