
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
        return res.status(404).json({ msg: "Utilisateur non trouvé", error: true });
      }

      if (user.isVerified) {
        return res.status(400).json({ msg: "Compte déjà vérifié", error: false });
      }

      user.isVerified = true;
      await user.save();

      // ✅ Rediriger vers le frontend après vérification
      res.redirect('http://localhost:5173/login?verified=true');

    } catch (error) {
      res.status(400).json({ msg: "Lien de vérification invalide ou expiré", error: true });
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
      return res.status(401).json({ message: "Refresh token manquant !" });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      const user = await User.findById(decoded.sub);

      if (!user) {
        return res.status(403).json({ message: "Utilisateur non trouvé !" });
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
      return res.status(403).json({ message: "Refresh token invalide ou expiré !" });
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

    res.redirect('http://localhost:5173/dashboard');
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

  forgotPassword: async function (req, res) {
    const { email } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          msg: "Si cette adresse existe, vous recevrez un email de réinitialisation.",
          error: false
        });
      }

      const resetToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Stocker le token de réinitialisation et sa date d'expiration
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 heure
      await user.save();

      const emailSent = await sendResetPasswordEmail(email, resetToken);
      if (!emailSent) {
        return res.status(500).json({
          msg: "Erreur lors de l'envoi de l'email",
          error: true
        });
      }

      return res.status(200).json({
        msg: "Si cette adresse existe, vous recevrez un email de réinitialisation.",
        error: false
      });
    } catch (error) {
      return res.status(500).json({
        msg: "Une erreur est survenue",
        error: true
      });
    }
  },

  resetPassword: async function (req, res) {
    const { token, password } = req.body;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({
        _id: decoded.id,
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          msg: "Le lien de réinitialisation est invalide ou a expiré",
          error: true
        });
      }

      // Mettre à jour le mot de passe
      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return res.status(200).json({
        msg: "Votre mot de passe a été réinitialisé avec succès",
        error: false
      });
    } catch (error) {
      return res.status(500).json({
        msg: "Une erreur est survenue",
        error: true
      });
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
        return res.status(400).json({ message: "Tous les champs sont obligatoires" });
      }

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

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
            return res.status(404).json({ message: "Utilisateur à assigner non trouvé" });
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





