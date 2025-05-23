const express = require("express");
const app = express();
require("dotenv").config();
const mongoose = require("mongoose");
require("./config/database");
const passport = require("passport");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const session = require("express-session");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
require("./Passport_config");

const path = require('path');
// to read body from request
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  res.removeHeader("Content-Security-Policy");
  next();
});

const allowedOrigins = [
  "http://localhost:5173",           // dev
  "https://staging.votly.co"         // production
];

app.use(
  session({
    secret: "123456",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,        // only over HTTPS
      sameSite: "none",    // required for cross-domain cookies
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Initialiser Passport et les sessions
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next(); // Ne pas parser les Webhooks Stripe en JSON
  } else {
    express.json()(req, res, next);
  }
});
app.use('/images', express.static(path.join(__dirname, 'images')));
// Routes

const userRoutes = require("./routes/UserRoutes");
const surveyRoutes = require("./routes/SurveyRouter");
//const paiementRoutes = require("./routes/PaiementRoutes");
app.use("/user", userRoutes);

app.use("/entreprises", require("./routes/entrepriseRouter"));
app.use("/invitations", require("./routes/invitationRouter"));
app.use("/", require("./routes/PaiementRoutes"));
app.use("/workspaces", require("./routes/workspaceRouter"));
app.use("/", surveyRoutes);
// Start the server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
