const mongoose = require("mongoose");
const SurveySchema = new mongoose.Schema({
  title: {
    type: Object, // ✅ Supports multiple languages (e.g., { ar: "...", default: "..." })
    required: true,
  },
  json: Object,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workspace",
    required: true,
  },

  userEmail: {
    type: String,
    required: false,
  },
  isClosed: {
    type: Boolean,
    required: false,
  },
  isPublished: {
    type: Boolean,
    required: false,
  },

  // Contient le JSON du formulaire Survey.js
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("Survey", SurveySchema);
