import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../user/user.model.js";

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/api/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;

            let user = await User.findOne({ email });

            if (!user) {
                user = await User.create({
                    email,
                    name: profile.displayName,
                    avatar: profile.photos[0].value,
                    provider: "google"
                });
            }

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));