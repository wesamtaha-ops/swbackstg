// migration.js - Script à exécuter une seule fois
const mongoose = require('mongoose');
const User = require('./models/user'); // Ajustez le chemin selon votre structure

async function addResetPasswordFields() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/votre_db_name');
    
    // Ajouter les champs à tous les utilisateurs existants
    const result = await User.updateMany(
      {}, // Tous les utilisateurs
      {
        $set: {
          resetPasswordToken: null,
          resetPasswordExpires: null
        }
      }
    );
    
    console.log(`${result.modifiedCount} utilisateurs mis à jour`);
    console.log('Migration terminée avec succès');
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Erreur lors de la migration:', error);
    mongoose.disconnect();
  }
}

addResetPasswordFields();