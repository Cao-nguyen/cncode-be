import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/api/auth/facebook/callback",
    profileFields: ["id", "emails", "name", "picture.type(large)"]
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const user = {
                email: profile.emails?.[0]?.value,
                name: `${profile.name.familyName} ${profile.name.givenName}`,
                avatar: profile.photos[0].value,
                provider: "facebook"
            };

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));