const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Declare the Schema of the Mongo model
var userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    linkedinId: {
      type: String,
      required: false,
      sparse: true,
    },

    is_subcribed: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
   
    isPermission: {
      type: Boolean,
      default: false,
    },
    plan: { type: String, default: "Free" },
    stripeCustomerId: String,
    subscriptionId: String,
    subscriptionEnd: Date,

    role: {
      type: String,
      enum: ["accountOwner", "companyOwner", "workspaceOwner", "editor", "viewer","user"],
       required: true,
  default: "user",
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: 'Entreprise',
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: 'Workspace',
    }


  },
  { timestamps: true }
);

//Presave middleware - NOTE: if use arrow function, this becomes empty object, and we can't use isModified()
userSchema.pre("save", function (next) {
  //If there's no change to password field (no change, no add new), call next()
  if (!this.isModified("password")) {
    next();
  }

  bcrypt.hash(this.password, 10, (err, hashedPassword) => {
    if (err) return next(err);
    this.password = hashedPassword;
    return next();
  });
});

//Custom method - if u wanna use 'this' as user document, don't use arrow function coz arrow function watch video 8 in my react document for more info

userSchema.methods.comparePassword = function (password, cb) {
  bcrypt.compare(password, this.password, (err, isMatch) => {
    if (err)
      return cb(err)
    if (!isMatch)
      return cb(null, false)
    return cb(null, this)
  })
}


//Export the model
module.exports = mongoose.model('User', userSchema);
