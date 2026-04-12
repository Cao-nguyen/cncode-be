import "dotenv/config";

import express from "express";
import session from "express-session";
import passport from "passport";

import routes from "./routes/index.js";

// OAuth
import "./modules/auth/auth.google.js";
// import "./modules/auth/auth.facebook.js";

import connectDB from "./config/db.js";

const app = express();

app.use(express.json());

connectDB();

app.use(session({
    secret: "cncode_secret",
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.get("/", (req, res) => {
    res.send("CNcode Backend Running 🚀");
});

app.use("/api", routes);

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`🚀 http://localhost:${PORT}`);
});