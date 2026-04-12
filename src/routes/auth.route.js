import express from "express";
import passport from "passport";

const router = express.Router();

// GOOGLE
router.get("/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/google/callback",
    passport.authenticate("google", { session: false }),
    (req, res) => {
        res.send(req.user); // sau này trả JWT
    }
);

// FACEBOOK
router.get("/facebook",
    passport.authenticate("facebook", { scope: ["email"] })
);

router.get("/facebook/callback",
    passport.authenticate("facebook", { session: false }),
    (req, res) => {
        res.send(req.user);
    }
);

export default router;