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
     // Champs pour la réinitialisation du mot de passe
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },

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
//Correction du middleware pre-save dans user.js
userSchema.pre("save", function (next) {
  console.log("=== MIDDLEWARE PRE-SAVE DEBUG ===");
  console.log("Password modifié:", this.isModified("password"));
  console.log("Password actuel:", this.password ? "***" : "vide");
  
  //Si il n'y a pas de changement sur le champ password, appeler next()
  if (!this.isModified("password")) {
    console.log("Password non modifié, passage sans hachage");
    return next();
  }
  console.log("Hachage du password en cours...");
  
  bcrypt.hash(this.password, 12, (err, hashedPassword) => { // Augmenter le salt à 12 pour plus de sécurité
    if (err) {
      console.error("Erreur lors du hachage:", err);
      return next(err);
    }
    
    console.log("Password haché avec succès");
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
