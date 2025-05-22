const express = require("express");
const Router = require("express").Router();
const router = express.Router();
const {
  CheckOut,
  Success,
  Customer,
  Webhook,
  getHistory,
  getPlan,
} = require("../controllers/paiement.controllers.js");

Router.post("/create-checkout-session", CheckOut);
Router.get("/subscribe", CheckOut);
Router.get("/user/plan/:userId", getPlan);
Router.get("/user/history/:userId", getHistory);
Router.get("/success", Success);
Router.get("/customers/:customerId", Customer);
Router.post("/webhook", express.raw({ type: "application/json" }), Webhook);
module.exports = Router;
