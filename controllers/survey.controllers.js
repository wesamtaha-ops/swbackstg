const Survey = require("../models/Survey");
const SurveyResponses = require("../models/SurveyResponse");
const SurveyVersion = require("../models/SurveyVersion");
const SurveyProgress = require("../models/SurveyProgress");
const axios = require("axios");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const Workspace = require("../models/workspace");
const User = require("../models/user");
//const Entreprise = require("../models/Entreprise");
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
// Create a new Survey
const CreateSurvey = async (req, res) => {
  try {
    const { title, json, createdBy, workspaceId } = req.body;
    const newSurvey = new Survey({
      title,
      json,
      createdBy,
      workspaceId,
    });
    await newSurvey.save();
    res.status(201).json({ message: "Formulaire créé avec succès !" });
  } catch (error) {
    res.status(500).json({ message: "Erreur création", error });
  }
};

// Update a Survey
const UpdateSurvey = async (req, res) => {
  try {
    const { title, json, updatedBy } = req.body;

    // Vérifier si le formulaire existe
    const survey = await Survey.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({ message: "Formulaire introuvable" });
    }

    // Trouver la dernière version enregistrée
    const lastVersion = await SurveyVersion.findOne({ surveyId: req.params.id })
      .populate({ path: "updatedBy", select: " email" })
      .sort({ version: -1 }) // Trier pour obtenir la version la plus récente
      .limit(1)
      .exec();

    const newVersionNumber = lastVersion ? lastVersion.version + 1 : 1;

    // Sauvegarder l'ancienne version avant modification
    const newVersion = new SurveyVersion({
      surveyId: req.params.id,
      updatedBy: updatedBy,
      version: newVersionNumber,
      json: json,
    });
    await newVersion.save();

    // Mettre à jour le formulaire avec les nouvelles données
    // survey.title = title;
    // survey.json = json;
    // await survey.save();

    res.json({
      message: "✅ Formulaire mis à jour et version sauvegardée !",
      newVersion,
    });
  } catch (error) {
    console.error("❌ Erreur API :", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour" + error, error });
  }
};

// Get all surveys
const GetAllSurveys = async (req, res) => {
  try {
    const surveys = await Survey.find();
    res.json(surveys);
  } catch (error) {
    res.status(500).json({ message: "Erreur récupération", error });
  }
};

// Get a single survey
const GetSurveyById = async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey) {
      return res.status(404).json({ message: "Formulaire non trouvé" });
    }

    res.json(survey);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

//Submit a survey
const SubmitSurveyRequest = async (req, res) => {
  try {
    const newResponse = new SurveyResponses({
      surveyId: req.params.id,
      responses: req.body,
    });

    await newResponse.save();

    res.status(201).json({ message: "Réponse enregistrée !" });
  } catch (error) {
    res.status(500).json({ message: "Erreur d'enregistrement", error });
  }
};

// Get all responses for a specific survey
const AllSurveyResponses = async (req, res) => {
  try {
    const responses = await SurveyResponses.find({ surveyId: req.params.id });
    res.json(responses);
  } catch (error) {
    res.status(500).json({ message: "Erreur récupération", error });
  }
};

// Get all versions from a survey
const GetAllSurveysVersions = async (req, res) => {
  try {
    const versions = await SurveyVersion.find({ surveyId: req.params.id })
      .populate("updatedBy", "username email")
      .sort({ version: -1 });

    res.json(versions);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des versions", error });
  }
};

// Get a versiobon from a survey
const GetSurveyVersionBySurveyId = async (req, res) => {
  try {
    const version = await SurveyVersion.findById(req.params.versionId);
    if (!version) {
      return res.status(404).json({ message: "Version introuvable" });
    }
    res.json(version);
  } catch (error) {
    console.error("❌ Erreur API :", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération de la version", error });
  }
};

// Back up a old version from a survey
const BackupSurveyVersion = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { versionId } = req.params;

    // Vérifier si versionId est valide
    if (!mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({ message: "ID de version invalide" });
    }

    // Récupérer la version à restaurer
    const version = await SurveyVersion.findById(versionId).session(session);
    if (!version) {
      return res.status(404).json({ message: "Version introuvable" });
    }

    // Récupérer le formulaire principal lié à cette version
    const survey = await Survey.findById(version.surveyId).session(session);
    if (!survey) {
      return res.status(404).json({ message: "Formulaire introuvable" });
    }

    // Restaurer la version
    survey.json = version.json;
    await survey.save({ session });

    // Valider et appliquer la transaction
    await session.commitTransaction();
    session.endSession();

    res.json({ message: "✅ Version restaurée avec succès !", survey });
  } catch (error) {
    // Annuler la transaction en cas d'erreur
    await session.abortTransaction();
    session.endSession();

    console.error("❌ Erreur API :", error);
    res.status(500).json({ message: "Erreur lors de la restauration", error });
  }
};

// UpDate a version from a survey
const UpdateSurveyVersion = async (req, res) => {
  try {
    const { json } = req.body;

    const version = await SurveyVersion.findById(req.params.versionId);
    if (!version) {
      return res.status(404).json({ message: "Version introuvable" });
    }

    version.json = json; // 🔹 Met à jour le contenu du formulaire dans cette version
    version.updatedAt = new Date(); // Ajoute la date de mise à jour
    await version.save();

    res.json({ message: "✅ Version mise à jour avec succès !", version });
  } catch (error) {
    console.error("❌ Erreur API :", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour de la version", error });
  }
};

// const PublishSurvey = async (req, res) => {
//     try {
//         const survey = await Survey.findById(req.params.id);
//         if (!survey) {
//             return res.status(404).json({ message: "Formulaire introuvable" });
//         }

//         res.json(survey); // 🔹 Retourne un JSON valide
//     } catch (error) {
//         console.error("❌ Erreur API :", error);
//         res.status(500).json({
//             message: "Erreur lors de la récupération du formulaire",
//             error: error.toString(),
//         });
//     }
// };

const GetSurveyByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "L'ID utilisateur est requis." });
    }

    const surveys = await Survey.find({ createdBy: userId }).sort({
      createdAt: -1,
    });

    res.status(200).json(surveys);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la récupération des formulaires",
      error,
    });
  }
};

const GetSurveyByWorkspaceId = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const surveys = await Survey.find({ workspaceId });

    res.status(200).json(surveys);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la récupération des formulaires",
      error,
    });
  }
};

const GenerateQuestion = async (req, res) => {
  try {
    const { prompt } = req.query;

    if (!prompt) {
      return res.status(400).json({ error: "Le paramètre 'text' est requis" });
    }

    // Requête GET avec paramètre dans l'URL
    const response = await axios.get(
      " https://ai.votly.co/api/generate_question",

      {
        params: { prompt },
        headers: { "Content-Type": "application/json" },
      }
    );

    res.json(response.data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la génération du questionnaire" });
  }
};

const GetAverageTime = async (req, res) => {
  try {
    const surveyId = req.params.id;

    // 🔹 Retrieve all responses for this survey using Mongoose
    const responses = await SurveyResponses.find({ surveyId });

    if (responses.length === 0) {
      return res.json({ averageTime: 0 }); // Return 0 if no responses exist
    }

    const responsesRaw = responses.map((response) => response.toObject());

    // 🔹 Calculate the total duration

    const totalDuration = responsesRaw.reduce((sum, response) => {
      return sum + (response.duration || 0);
    }, 0);

    const avgTime = totalDuration / responses.length;
    res.json({ averageTime: Math.round(avgTime) }); // Return rounded avg time
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const PublishSurvey = async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // 📌 Update survey status
    survey.isPublished = true;
    await survey.save();

    // 📌 Generate the survey link
    const clientEmail = req.body.email;
    const surveyLink = `https://staging.votly.co/survey?id=${
      survey._id
    }&email=${encodeURIComponent(clientEmail)}`;

    // 📌 Email options
    const mailOptions = {
      from: `"Survey Team" < ${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: "We value your opinion! Complete our survey today 🎯",
      html: `
        <div style="font-family: 'Poppins', Arial, sans-serif; background-color: #f4f7fb; padding: 40px 0; text-align: center;">
          <div style="max-width: 600px; background: white; padding: 20px 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); margin: auto;">
            
            <h2 style="color: #2d5e8f; font-family: 'Poppins', sans-serif; margin-bottom: 15px;">We Need Your Input! 📝</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Your opinion matters to us! Help us improve our services by taking a few minutes to complete this short survey.
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              It will only take <strong>2 minutes</strong> and will help us provide you with an even better experience!
            </p>

            <div style="margin: 20px 0;">
              <a href="${surveyLink}" style="
                background-color: #2d5e8f;
                color: white;
                padding: 14px 24px;
                font-size: 16px;
                font-weight: bold;
                text-decoration: none;
                border-radius: 6px;
                display: inline-block;
                font-family: 'Poppins', sans-serif;
              ">Take the Survey Now</a>
            </div>

            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              As a thank you, you'll be entered into a <strong>special giveaway</strong> once you complete the survey! 🎁
            </p>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">

            <p style="color: #777; font-size: 14px;">
              Thank you for your time and valuable feedback! <br>
              <strong style="color: #2d5e8f;">The Survey Team</strong>
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Survey published and email sent successfully!" });
  } catch (error) {
    console.error("❌ API Error:", error);
    res.status(500).json({
      message: "Error while publishing and sending the survey",
      error: error.toString(),
    });
  }
};

const CheckProgressByUser = async (req, res) => {
  const { surveyId, userEmail } = req.params;

  try {
    const progress = await SurveyProgress.findOne({ surveyId, userEmail });

    if (progress) {
      res.json({
        progress: progress.progress,
        completed: progress.progress === 100,
      });
    } else {
      res.json({ progress: 0, completed: false });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};
const CheckCompletionBySurvey = async (req, res) => {
  const { surveyId } = req.params;

  try {
    const completionData = await SurveyProgress.aggregate([
      {
        $match: {
          surveyId: surveyId.toString(), // 🔹 Convert to string to avoid mismatches
        },
      },
      {
        $group: {
          _id: "$surveyId",
          averageCompletion: { $avg: "$progress" },
          totalResponses: { $sum: 1 },
        },
      },
    ]);

    if (!completionData.length) {
      return res.json({
        _id: surveyId,
        averageCompletion: 0,
        totalResponses: 0,
        message: "No responses yet.",
      });
    }

    res.json(completionData[0]);
  } catch (error) {
    console.error("❌ Error calculating survey completion:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const VerifiyProgressByUser = async (req, res) => {
  const { surveyId, userEmail } = req.params;

  try {
    const progress = await SurveyResponses.findOne({ surveyId, userEmail });

    if (progress) {
      res.json({ progress: progress.progress }); // ✅ Assure-toi de renvoyer uniquement progress
    } else {
      res.json({ progress: 0 }); // ✅ Si pas trouvé, considérer comme non rempli
    }
  } catch (error) {
    console.error("❌ Erreur serveur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const getSurveyResponseCount = async (req, res) => {
  const { surveyId } = req.params; // 🔹 Récupération du survey ID depuis l'URL

  try {
    const responseCount = await SurveyResponses.countDocuments({ surveyId });

    res.json({
      responseCount,
    });
  } catch (error) {
    console.error("❌ Error fetching response count:", error);
    res.status(500).json({ message: "Error fetching response count" });
  }
};

const getSurveyStats = async (req, res) => {
  const { surveyId } = req.params;

  try {
    const responses = await SurveyResponses.find({ surveyId });
    if (!responses.length) {
      return res.status(404).json({
        message: "No responses found for this survey",
        completedResponses: 0,
        incompleteResponses: 0,
        avgResponseTime: 0,
      });
    }
    const responsesRaw = responses.map((response) => response.toObject());

    // 🟢 Compter les réponses complètes & incomplètes
    const completedResponses = responsesRaw.filter(
      (r) => r.progress === 100
    ).length;
    const incompleteResponses = responsesRaw.length - completedResponses;

    // ⏳ Calcul du temps moyen de réponse
    const totalDuration = responsesRaw.reduce((sum, r) => sum + r.duration, 0);
    const avgResponseTime = totalDuration / responsesRaw.length || 0;

    res.json({
      surveyId,
      completedResponses,
      incompleteResponses,
      avgResponseTime: avgResponseTime.toFixed(2), // ✅ Retourner avec 2 décimales
    });
  } catch (error) {
    console.error("❌ Error fetching survey stats:", error);
    res.status(500).json({ message: "Error fetching survey stats" });
  }
};

const UpdateProgressByUser = async (req, res) => {
  const { surveyId, userEmail, progress, responses, duration } = req.body;
  console.log("[Reçu] :", {
    surveyId,
    userEmail,
    progress,
    responses,
    duration,
  });

  // Vérification des champs requis
  if (
    !surveyId ||
    !userEmail ||
    progress === undefined ||
    duration === undefined
  ) {
    return res.status(400).json({ error: "Données manquantes" });
  }

  try {
    // Vérifie si une progression existe déjà pour ce sondage + utilisateur
    let existingProgress = await SurveyResponses.findOne({
      surveyId,
      userEmail,
    });

    if (existingProgress) {
      // Mise à jour des champs existants
      existingProgress.progress = progress;
      existingProgress.responses = responses ?? existingProgress.responses;
      existingProgress.duration = duration;
      existingProgress.updatedAt = Date.now(); // Met à jour la date de modification

      await existingProgress.save();

      return res.status(200).json({
        message: "Progression mise à jour !",
        progress: existingProgress,
      });
    } else {
      // Création d'un nouveau document
      const newProgress = new SurveyResponses({
        surveyId,
        userEmail,
        progress,
        responses: responses ?? {},
        duration,
      });

      await newProgress.save();

      return res.status(201).json({
        message: "Progression enregistrée !",
        progress: newProgress,
      });
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la progression :", error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

const RetargetSurvey = async (req, res) => {
  const { email, surveyID, progress } = req.body;

  try {
    const survey = await Survey.findById(surveyID);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // 📌 Générer le lien du sondage
    const surveyLink = `https://staging.votly.co/survey?id=${
      survey._id
    }&email=${encodeURIComponent(email)}`;

    // 📌 Email options
    const mailOptions = {
      from: `"Survey Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your survey is waiting! ⏳ Complete it now",
      html: `
        <div style="font-family: 'Poppins', Arial, sans-serif; background-color: #f4f7fb; padding: 40px 0; text-align: center;">
          <div style="max-width: 600px; background: white; padding: 20px 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); margin: auto;">
            
            <h2 style="color: #2d5e8f; font-family: 'Poppins', sans-serif; margin-bottom: 15px;">Almost there! 🚀</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              You’ve made great progress on your survey, but it’s not finished yet.
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Your current progress: <strong style="color: #2d5e8f; font-size: 18px;"> ${progress}%</strong>
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              It only takes a few more minutes to complete it!
            </p>

            <div style="margin: 20px 0;">
              <a href="${surveyLink}" style="
                background-color: #2d5e8f;
                color: white;
                padding: 14px 24px;
                font-size: 16px;
                font-weight: bold;
                text-decoration: none;
                border-radius: 6px;
                display: inline-block;
                font-family: 'Poppins', sans-serif;
              ">Complete Your Survey Now</a>
            </div>

            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              By finishing the survey, you’ll help us provide a better experience for you. Plus, you might get a *special reward* 🎁!
            </p>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">

            <p style="color: #777; font-size: 14px;">
              Thank you for your time! <br>
              <strong style="color: #2d5e8f;">The Survey Team</strong>
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Retargeting email sent successfully!" });
  } catch (error) {
    console.error("❌ API Error:", error);
    res.status(500).json({
      message: "Error while sending the retargeting email",
      error: error.toString(),
    });
  }
};
const getStatusSurvey = async (req, res) => {
  const { surveyId } = req.params;
  try {
    console.log(surveyId);
    const survey = await Survey.findById(surveyId);

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // ✅ Return status 200 if survey exists
    return res.status(200).json(
      survey.isClosed // Ensure this is the correct field
    );
  } catch (error) {
    console.error("❌ API Error:", error);
    res.status(500).json({
      message: "Error while getting survey status",
      error: error.toString(),
    });
  }
};
const closeSurvey = async (req, res) => {
  const { surveyId } = req.params; // Récupération de l'ID depuis l'URL

  try {
    console.log("Closing survey with ID:", surveyId);

    // ✅ Met à jour le champ isClosed à true
    const survey = await Survey.findByIdAndUpdate(
      surveyId,
      { isClosed: true }, // Met à jour le champ
      { new: true } // Retourne le document mis à jour
    );

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    return res.status(200).json({
      message: "Survey closed successfully",
      isClosed: survey.isClosed,
    });
  } catch (error) {
    console.error("❌ API Error:", error);
    res.status(500).json({
      message: "Error while closing survey",
      error: error.toString(),
    });
  }
};
const statsCompany = async (req, res) => {
  const { companyId } = req.params;
  try {
    const numWorkspaces = await Workspace.countDocuments({
      companyOwner: companyId,
    });

    const workspaces = await Workspace.find({ companyOwner: companyId }).select(
      "_id"
    );
    const workspaceIds = workspaces.map((w) => w._id);
    const numForms = await Survey.countDocuments({
      workspaceId: { $in: workspaceIds },
    });

    const numMembers = await User.countDocuments({
      workspaceId: { $in: workspaceIds },
    });

    const numClosedForms = await Survey.countDocuments({
      workspaceId: { $in: workspaceIds },
      isClosed: true,
    });
    const numPublishedForms = await Survey.countDocuments({
      workspaceId: { $in: workspaceIds },
      isPublished: true,
    });

    const surveys = await Survey.find({
      workspaceId: { $in: workspaceIds },
    }).select("_id");
    const surveyIds = surveys.map((s) => s._id);

    const responses = await SurveyResponses.find({
      surveyId: { $in: surveyIds },
    });
    const totalTime = responses.reduce(
      (acc, res) => acc + (res.duration || 0),
      0
    );
    const avgTimeTotal = responses.length ? totalTime / responses.length : 0;

    const completedForms = responses.filter(
      (res) => res.progress === 100
    ).length;
    const totalFormsResponses = responses.length;
    const completionPercentage = totalFormsResponses
      ? (completedForms / totalFormsResponses) * 100
      : 0;

    // Définir la structure des mois de l'année
    const months = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ];

    // Création d'un tableau avec tous les mois initialisés à zéro
    let monthlyDataTemplate = months.map((month) => ({
      month,
      members: 0,
      avgResponseTime: 0,
      completionRate: 0,
      responses: 0,
      workspaces: 0,
      forms: 0,
      closedForms: 0,
      publishedForms: 0,
    }));

    // Récupérer les stats mensuelles
    const membersByMonth = await User.aggregate([
      { $match: { workspaceId: { $in: workspaceIds } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
    ]);
    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const workspacesByMonth = await Workspace.aggregate([
      { $match: { companyOwner: companyObjectId } },
      {
        $group: {
          _id: { $month: "$createdAt" }, // <-- fonctionne grâce à timestamps
          count: { $sum: 1 },
        },
      },
    ]);

    const formsByMonth = await Survey.aggregate([
      { $match: { workspaceId: { $in: workspaceIds } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
    ]);

    const responsesByMonth = await SurveyResponses.aggregate([
      {
        $match: {
          surveyId: {
            $in: surveyIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" }, // Groupement par mois
          count: { $sum: 1 }, // Nombre de réponses
        },
      },
    ]);
    // Assigner les valeurs aux mois correspondants
    membersByMonth.forEach((m) => {
      monthlyDataTemplate[m._id - 1].members = m.count;
    });

    workspacesByMonth.forEach((w) => {
      const monthIndex = w._id - 1; // -1 car les indices commencent à 0
      if (monthlyDataTemplate[monthIndex]) {
        monthlyDataTemplate[monthIndex].workspaces = w.count;
      }
    });

    formsByMonth.forEach((f) => {
      monthlyDataTemplate[f._id - 1].forms = f.count;
    });

    // Associer les valeurs MongoDB aux mois correspondants
    responsesByMonth.forEach((r) => {
      const monthIndex = r._id - 1; // `_id` = 1 pour janvier, donc -1 pour index
      if (monthlyDataTemplate[monthIndex]) {
        monthlyDataTemplate[monthIndex].responses = r.count;
      }
    });
    res.json({
      workspaces: numWorkspaces,
      forms: numForms,
      members: numMembers,
      closedForms: numClosedForms,
      publishedForms: numPublishedForms,
      avgResponseTime: avgTimeTotal.toFixed(2),
      completionRate: completionPercentage.toFixed(2) + "%",
      monthlyData: monthlyDataTemplate,
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
module.exports = {
  getStatusSurvey,
  RetargetSurvey,
  closeSurvey,
  getSurveyStats,
  VerifiyProgressByUser,
  getSurveyResponseCount,
  GetAverageTime,
  UpdateProgressByUser,
  UpdateProgressByUser,
  CheckProgressByUser,
  CheckCompletionBySurvey,
  CreateSurvey,
  UpdateSurvey,
  GetAllSurveys,
  GetSurveyById,
  SubmitSurveyRequest,
  AllSurveyResponses,
  GetAllSurveysVersions,
  GetSurveyVersionBySurveyId,
  BackupSurveyVersion,
  UpdateSurveyVersion,
  PublishSurvey,
  GetSurveyByUser,
  GenerateQuestion,
  GetSurveyByWorkspaceId,
  statsCompany,
};
