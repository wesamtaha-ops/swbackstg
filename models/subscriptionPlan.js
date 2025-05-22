const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,

  },
  price: {
    type: double,
    required: true,

  },
  features: {
    type: String,
    required: true,

  },
  expirationDate: {
    type: Date,
    required: true,
  },
},
  { timestamps: true },
);

//Export the model
module.exports = mongoose.model('Plan', planSchema);
