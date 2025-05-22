const mongoose = require("mongoose");
const SurveyVersionSchema = new mongoose.Schema({
    surveyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Survey",
        required: true,
    },


    updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

    version: { type: Number, required: true }, // Numéro de version
    json: { type: Object, required: true }, // Contenu du formulaire
    createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("SurveyVersion", SurveyVersionSchema);