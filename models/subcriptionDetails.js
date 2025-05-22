const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var subcriptionDetailsSchema = new mongoose.Schema(
  {
    id_user: {
      type: mongoose.Schema.Types.ObjectId, // Corrected type definition
      required: true,
      ref: "user", // Reference to the "user" collection
    },
    id_customer: String,
    stripeSubscriptionId: String,
    plan: String,
    status: String,
    startDate: Date,
    endDate: Date,
    periodicity: String,
  },
  { timestamps: true }
);

//Export the model
module.exports = mongoose.model(
  "SubscriptionDetails",
  subcriptionDetailsSchema
);
