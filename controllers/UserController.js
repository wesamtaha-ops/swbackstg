
const mongoose = require("mongoose");
const User = require('../models/user');
const Entreprise = require("../models/entreprise");
const Workspace = require("../models/workspace");
const Invitation = require("../models/invitation");
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const { sendVerificationEmail } = require('../service/emailService');
const { sendResetPasswordEmail } = require('../service/emailService');
const user = require('../models/user');

//To sign JWT token before sending in cookie to Client
function signToken(userID) {
  return jwt.sign({
    iss: 'moonServer',
    sub: userID
  }, process.env.JWT_SECRET, { expiresIn: '24h' })
}

function signRefreshToken(userID) {
  return jwt.sign({
    iss: 'moonServer',
    sub: userID
  }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '3d' });
}



function generateVerificationToken(email) {
  return jwt.sign(
    { email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = {
  register: async function (req, res) {
    const { username, email, password, role, companyId, workspaceId, invitationToken } = req.body;

    try {
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.status(400).json({ msg: "User already exists", error: true });
      }

      const newUser = new User({
        username,
        email,
        password,
        isVerified: false,
        isPermission: false,
        role: role || "user",
        companyId,
        workspaceId,

      });

      await newUser.save();



      if (invitationToken) {
        const invitation = await Invitation.findOne({ token: invitationToken, status: 'Pending' });
        if (invitation) {
          invitation.status = 'accepted';
          await invitation.save();
        }
      }


      if (companyId) {
        const enterprise = await Entreprise.findById(companyId);
        if (enterprise) {
          enterprise.team.push({
            userId: newUser._id,
          });
          await enterprise.save();
        }
      }
      if (workspaceId) {

        const workspace = await Workspace.findById(workspaceId);
        if (workspace) {
          workspace.team.push({
            userId: newUser._id,
          });
          await workspace.save();
        }
      }




      // Génération du token d'authentification
      const token = signToken(newUser.id);

      res.cookie("access_token", token, {
        maxAge: 3600 * 1000,
        httpOnly: true,
        sameSite: true
      });
      const verificationToken = generateVerificationToken(email);
      const emailSent = await sendVerificationEmail(email, verificationToken);

      if (!emailSent) {
        return res.status(500).json({
          msg: "Erreur lors de l'envoi de l'email de vérification",
          error: true
        });
      }
      return res.status(200).json({
        msg: "Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.",
        error: false
      });

    } catch (err) {
      console.error('Error in register:', err);
      return res.status(500).json({ msg: err.message });
    }
  },


  verifyEmail: async function (req, res) {
    const { token } = req.params;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({ email: decoded.email });

      if (!user) {
        return res.status(404).json({ msg: "User not found", error: true });
      }

      if (user.isVerified) {
        return res.status(400).json({ msg: "Account already verified", error: false });
      }

      user.isVerified = true;
      await user.save();

      // ✅ Redirect to frontend after verification
      res.redirect('https://staging.votly.co/login?verified=true');

    } catch (error) {
      res.status(400).json({ msg: "Invalid or expired verification link", error: true });
    }
  },




  login: async function (req, res) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect !" });
      }


      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect !" });
      }


      const token = signToken(user._id);
      const refreshToken = signRefreshToken(user._id);


      res.cookie("access_token", token, {
        httpOnly: true,
        maxAge: 15 * 60 * 1000,
        secure: true,
        sameSite: "Strict",

      });

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        maxAge: 3 * 24 * 60 * 60 * 1000,
        secure: true,
        sameSite: "Strict",
      });

      return res.status(200).json({
        isAuthenticated: true,
        token,
        refreshToken,
        user: {
          email: user.email,
          role: user.role,
          _id: user._id,
          username: user.username,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la connexion :", error);
      return res.status(500).json({ message: "Erreur serveur" });
    }
  },

  refreshToken: async function (req, res) {
    console.log("Cookies reçus :", req.cookies);
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token missing!" });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      const user = await User.findById(decoded.sub);

      if (!user) {
        return res.status(403).json({ message: "User not found!" });
      }


      const newAccessToken = signToken(user._id);

      res.cookie("access_token", newAccessToken, {
        httpOnly: true,
        maxAge: 15 * 60 * 1000,
        secure: true,
        sameSite: "Strict",
      });

      return res.status(200).json({
        accessToken: newAccessToken,
      });

    } catch (error) {
      return res.status(403).json({ message: "Refresh token invalid or expired!" });
    }

  },


  authenticated: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ isAuthenticated: false, message: "User not connected" });
      }

      const { email, _id, username, role, isPermission, plan, isVerified } = req.user;
      const user = await User.findById(req.user._id).populate("companyId", "_id name Owner").populate('workspaceId', '_id name');

      if (!user) {
        return res.status(200).json({ isAuthenticated: false, message: "User not found" });
      }

      // Vérifie si l'utilisateur a une entreprise associée
      const companyData = user.companyId
        ? { id: user.companyId._id, name: user.companyId.name }
        : null;
      // Vérifie si l'utilisateur a une workspace associée
      const workspaceData = user.workspaceId
        ? { id: user.workspaceId._id, name: user.workspaceId.name }
        : null;

      return res.status(200).json({
        isAuthenticated: true,
        user: { email, _id, username, role, companyId: companyData, workspaceId: workspaceData, isPermission, plan, isVerified }
      });
    } catch (error) {
      console.error("Error in authenticated API:", error);
      return res.status(500).json({ isAuthenticated: false, message: "Internal Server Error" });
    }
  },


  logout: function (req, res) {

    if (req.cookies) {

      Object.keys(req.cookies).forEach((cookie) => {
        res.clearCookie(cookie, { httpOnly: true, secure: true, sameSite: "strict" });
      });
    }

    return res.status(200).json({ success: true, user: { email: "", role: "" } });
  },


  githubCallback: function (req, res) {

    res.redirect('https://staging.votly.co/dashboard');
  },



  googleCallback: function (req, res) {
    if (!req.isAuthenticated()) {
      res.send(`<h1>opssss</h1>`);
    }
    res.send(`
  <h1>Dashboard</h1>
  <p>Welcome, ${req.user.username}!</p>
  <p>Email: ${req.user.email}</p>
  <img src="${req.user.avatar}" width="100"/>

`);
  },

// Correction de la fonction forgotPassword
forgotPassword: async function (req, res) {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        msg: "If this email exists, you will receive a password reset email.",
        error: false
      });
    }

    console.log("=== FORGOT PASSWORD DEBUG ===");
    console.log("User found:", user.email, user._id);

    // Générer un token de réinitialisation
    const resetToken = jwt.sign(
      { 
        userId: user._id.toString(), // S'assurer que c'est une string
        email: user.email,
        type: 'password-reset' // Ajouter un type pour plus de sécurité
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log("Token généré:", resetToken);

    // Stocker le token de réinitialisation et sa date d'expiration
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 heure
    await user.save();

    console.log("Token stocké:", user.resetPasswordToken);
    console.log("Expire à:", user.resetPasswordExpires);

    const emailSent = await sendResetPasswordEmail(email, resetToken);
    if (!emailSent) {
      return res.status(500).json({
        msg: "Error sending email",
        error: true
      });
    }

    return res.status(200).json({
      msg: "If this email exists, you will receive a password reset email.",
      error: false
    });
  } catch (error) {
    console.error("Erreur forgotPassword:", error);
    return res.status(500).json({
      msg: "An error occurred",
      error: true
    });
  }
},

// Correction de la fonction resetPassword dans UserController.js
resetPassword: async function (req, res) {
  const { token, password } = req.body;
  
  console.log("=== RESET PASSWORD DEBUG ===");
  console.log("Token reçu:", token);
  console.log("Password reçu:", password ? "***" : "vide");
  
  try {
    // Vérifier si le token et le password sont présents
    if (!token || !password) {
      console.log("Token ou password manquant");
      return res.status(400).json({
        msg: "Token et mot de passe requis",
        error: true
      });
    }

    // Vérifier la longueur minimale du mot de passe
    if (password.length < 6) {
      console.log("Password trop court");
      return res.status(400).json({
        msg: "Le mot de passe doit contenir au moins 6 caractères",
        error: true
      });
    }

    // Décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token décodé:", decoded);
    
    // Rechercher l'utilisateur avec toutes les conditions
    const user = await User.findOne({
      _id: decoded.userId || decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      // Essayer de trouver par email si userId ne fonctionne pas
      const userByEmail = await User.findOne({
        email: decoded.email,
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      });
      
      if (!userByEmail) {
        return res.status(400).json({
          msg: "Le lien de réinitialisation est invalide ou a expiré",
          error: true
        });
      }
      
      // CORRECTION : Ne pas hacher ici, laisser le middleware le faire
      userByEmail.password = password; // Mot de passe en clair
      userByEmail.resetPasswordToken = undefined;
      userByEmail.resetPasswordExpires = undefined;
      await userByEmail.save(); // Le middleware pre('save') va hacher automatiquement
      
      console.log("Mot de passe mis à jour pour:", userByEmail.email);
      
      return res.status(200).json({
        msg: "Votre mot de passe a été réinitialisé avec succès",
        error: false
      });
    }

    // CORRECTION : Ne pas hacher ici, laisser le middleware le faire
    user.password = password; // Mot de passe en clair
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save(); // Le middleware pre('save') va hacher automatiquement

    console.log("Mot de passe mis à jour pour l'utilisateur:", user.email);

    return res.status(200).json({
      msg: "Votre mot de passe a été réinitialisé avec succès",
      error: false
    });
    
  } catch (error) {
    console.error("Erreur lors de la réinitialisation:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({
        msg: "Token invalide",
        error: true
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        msg: "Le lien de réinitialisation a expiré",
        error: true
      });
    }
    
    return res.status(500).json({
      msg: "Une erreur est survenue lors de la réinitialisation",
      error: true
    });
  }
},
// À ajouter temporairement dans UserController.js pour le debug
checkToken: async function (req, res) {
  const { token } = req.params;
  
  try {
    console.log("=== CHECK TOKEN DEBUG ===");
    console.log("Token à vérifier:", token);
    
    // Décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token décodé:", decoded);
    
    // Chercher l'utilisateur
    const user = await User.findOne({ resetPasswordToken: token });
    console.log("Utilisateur avec ce token:", user ? {
      email: user.email,
      tokenExpires: user.resetPasswordExpires,
      tokenValid: user.resetPasswordExpires > Date.now()
    } : "Non trouvé");
    
    return res.status(200).json({
      decoded,
      user: user ? {
        email: user.email,
        tokenExpires: user.resetPasswordExpires,
        tokenValid: user.resetPasswordExpires > Date.now(),
        currentTime: new Date(Date.now())
      } : null
    });
    
  } catch (error) {
    console.error("Erreur check token:", error);
    return res.status(400).json({ error: error.message });
  }
},


  deleteUser: async function (req, res) {
    try {

      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }
      await Entreprise.updateMany(
        { "team.userId": req.params.id },
        { $pull: { team: { userId: req.params.id } } }
      );

      await Workspace.updateMany(
        { "team.userId": req.params.id },
        { $pull: { team: { userId: req.params.id } } }
      );

      await Invitation.deleteMany({ email: user.email });
      await User.findByIdAndDelete(req.params.id);

      res.json({ msg: "User deleted successfuly", status: 200 });
    } catch (error) {

      res.status(500).json({ msg: "Error server", error: error.message });
    }
  },


  updateUserRole: async function (req, res) {
    try {
      const { userId, role } = req.body;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      user.role = role;
      await user.save();

      return res.status(200).json({ message: "Role updated successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Error server", error });
    }
  },

  updateRole: async function (req, res) {
    try {
      const { userId, newRole, entityId, entityType, confirmReassign } = req.body;

      if (!userId || !newRole || !entityId || !entityType) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Si le rôle est workspaceOwner, vérifier si un autre utilisateur possède ce rôle
      if (newRole === "workspaceOwner") {
        const existingOwner = await User.findOne({
          role: "workspaceOwner",
          [`${entityType}Id`]: entityId,
        });

        if (existingOwner && existingOwner._id !== userId) {
          // Réassigner le rôle workspaceOwner à un autre utilisateur si un autre utilisateur possède déjà ce rôle
          if (!confirmReassign) {
            return res.status(400).json({
              message: `Il y a déjà un utilisateur avec le rôle de ${newRole}. Veuillez sélectionner un autre utilisateur pour transférer ce rôle.`,
              existingOwnerId: existingOwner._id,
            });
          }

          // Si confirmReassign est fourni, réattribuer le rôle workspaceOwner à un autre utilisateur
          const newOwner = await User.findById(confirmReassign);
          if (!newOwner) {
            return res.status(404).json({ message: "User to assign not found" });
          }

          // Mettre à jour l'ancien propriétaire pour lui donner un role inferieur
          existingOwner.role = "editor"; // Réattribuer un rôle inférieur
          await existingOwner.save();

          // Reattribuer  role Owner au nouvel utilisateur
          newOwner.role = "workspaceOwner";
          await newOwner.save();
        }
      }
      // Vérifier si l'utilisateur est le seul propriétaire (workspaceOwner ou companyOwner)
      if (user.role === "workspaceOwner" || user.role === "companyOwner") {
        const ownerCount = await User.countDocuments({
          role: user.role,
          [`${entityType}Id`]: entityId,
        });

        if (ownerCount === 1 && newRole !== user.role) {
          return res.status(400).json({
            message: "Impossible de changer le rôle de l'unique propriétaire.",
          });
        }
      }

      user.role = newRole;
      await user.save();

      return res.status(200).json({ message: "Rôle mis à jour avec succès", user });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du rôle :", error);
      return res.status(500).json({ message: "Erreur serveur", error });
    }
  },


  updateUser: async function (req, res) {
    try {

      console.log("Email reçu :", req.params.email);
      console.log("Corps de la requête :", req.body);

      const email = req.params.email;
      const { username } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ msg: "Utilisateur non trouvé" });
      }

      user.username = username;
      await user.save();

      return res.status(200).json({ msg: "Profil mis à jour avec succès" });

    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil :", error);
      return res.status(500).json({ msg: "Erreur serveur" });
    }
  },



  updatePermission: async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Toggle permission (switch between true and false)
      user.isPermission = !user.isPermission;
      await user.save();

      res.status(200).json({
        message: `Permission ${user.isPermission ? "granted" : "revoked"}`,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          isPermission: user.isPermission,
          role: user.role,
          workspaceId: user.workspaceId,
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Error updating permission", error });
    }
  }


}





