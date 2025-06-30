const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const User = require('./models/user');



function extractJwtFromCookie(req) {
  const token = req.cookies.access_token;
  return token
}


// Stratégie locale
passport.use(
  new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    User.findOne({ email }, (err, user) => {
      if (err)
        return done(err)
      if (user)
        return user.comparePassword(password, done)
      return done(null, false)
    })
  })
)
passport.use(
  new JwtStrategy(
    { jwtFromRequest: extractJwtFromCookie, secretOrKey: process.env.JWT_SECRET },
    async (payload, done) => { // ✅ Ajout de `async`
      try {
        const user = await User.findById(payload.sub); // ✅ Suppression du callback
        if (user) {
          return done(null, user); // ✅ Attache l'utilisateur à `req.user`
        }
        return done(null, false);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);
// Stratégie GitHub
passport.use(new GitHubStrategy(
  {
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "https://backend.votly.app/user/github/callback",
    scope: ["user:email"]
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ githubId: profile.id });

      if (!user) {
        // Nouvel utilisateur => Inscription
        user = await User.create({
          githubId: profile.id,
          username: profile.username,
          email: profile.emails?.[0]?.value || null,
        });
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
)
);
// Stratégie Google
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/user/google/callback"
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = new User({
          googleId: profile.id,
          username: profile.displayName,
          email: profile.emails[0].value,
        });
        await user.save();
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});
module.exports = passport;
