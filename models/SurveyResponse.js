const mongoose = require("mongoose");
const ResponseSchema = new mongoose.Schema(
  {
    surveyId: String,
    responses: Object,
    userEmail: String,
    progress: Number,
    duration: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
module.exports = mongoose.model("SurveyResponse", ResponseSchema);