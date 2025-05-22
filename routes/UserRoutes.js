const Router = require("express").Router();
var express = require("express");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const UserController = require("../controllers/UserController");
require("../Passport_config");
require("dotenv").config();
const axios = require("axios");
const passport = require("passport");

//register
Router.post("/register", UserController.register);

// Inscription via LinkedIn
Router.get(
  "/linkedin",
  passport.authenticate("linkedin", { state: "SOME_STATE" })
);

Router.post("/login", UserController.login);

Router.get(
  "/profile",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.json({ user: req.user });
  }
);

Router.post(
  "/logout",
  passport.authenticate("jwt", { session: false }),
  UserController.logout
);
Router.get(
  "/authenticated",
  passport.authenticate("jwt", { session: false }),
  UserController.authenticated
);

Router.delete("/deleteUser/:id", UserController.deleteUser);
Router.get("/verify/:token", UserController.verifyEmail);

Router.put("/update-role", UserController. updateUserRole);
Router.put("/updateRole", UserController.updateRole);
Router.put("/put/:email", UserController.updateUser);
Router.put("/permission/:userId", UserController.updatePermission);
Router.post("/refresh-token", UserController.refreshToken);


// Inscription via Google
Router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
Router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  UserController.googleCallback
);

// Authentification avec GitHub
Router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);
Router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  UserController.githubCallback
);

// Authentification avec LinkedIn
Router.get(
  "/linkedin",
  passport.authenticate("linkedin", {
    scope: ["r_liteprofile", "r_emailaddress"],
  })
);





module.exports = Router;
