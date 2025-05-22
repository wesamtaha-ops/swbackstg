const mongoose = require("mongoose");

const SurveyProgressSchema = new mongoose.Schema({
    surveyId: { type: String, required: true },
    userEmail: String,
    progress: Number,
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SurveyProgress", SurveyProgressSchema);