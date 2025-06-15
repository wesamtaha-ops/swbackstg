require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const SubscriptionDetails = require("../models/subcriptionDetails");
const User = require("../models/user");
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "marwen.jammeli@gmail.com",
    pass: "eoxiludvcjaebeez",
  },
});

// 🎯 Liste des plans avec leurs IDs Stripe
const priceIdToPlan = {
  price_1QlesoBX82yYbD239blRQrwa: "Free",
  price_1Qlet9BX82yYbD232b8nKcz5: "Basic",
  price_1QletUBX82yYbD23C9SSH5YK: "Advanced",
  price_1QletxBX82yYbD23t30AKzWD: "Premium",
};
// ✅ Fonction pour envoyer un email de confirmation d'abonnement
const sendSubscriptionEmail = async (
  userEmail,
  plan,
  startDate,
  endDate,
  amount
) => {
  const mailOptions = {
    from: "marwen.jammeli@gmail.com",
    to: userEmail,
    subject: `Confirmation of Your Subscription - ${plan}`,
    html: `
    <div style="background-color:#f4f4f4; padding:20px; font-family:Arial, sans-serif;">
      <table align="center" width="600" style="background-color:#ffffff; padding:20px; border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,0.1);">
        <!-- Logo -->
        <tr>
          <td align="center">
            <img src="https://votly.app/public/web/wp-content/themes/Votly-logo-colored.png" alt="Logo" width="120">
          </td>
        </tr>
        
        <!-- Title -->
        <tr>
          <td align="center" style="font-size:22px; font-weight:bold; color:#333;">
            Subscription Confirmation
          </td>
        </tr>
  
        <!-- Message -->
        <tr>
          <td style="padding:20px; font-size:16px; color:#555;">
            Hello, <br><br>
            Thank you for subscribing to our <strong>${plan}</strong> plan. Here are the details of your subscription:
          </td>
        </tr>
  
        <!-- Subscription Details -->
        <tr>
          <td style="padding:10px; border-top:1px solid #ddd;">
            <strong>Plan:</strong> ${plan} <br>
            <strong>Start Date:</strong> ${startDate.toLocaleDateString()} <br>
            <strong>Expiration Date:</strong> ${endDate.toLocaleDateString()} <br>
            <strong>Amount Paid:</strong> ${amount} USD
          </td>
        </tr>
        <!-- Manage Subscription Button -->
        <!-- Footer -->
        <tr>
          <td align="center" style="padding:20px; font-size:14px; color:#777;">
            If you have any questions, contact us at 
            <a href="mailto:support@your-website.com" style="color:#3068FF;">support@your-website.com</a>
            <br><br>
            <small>&copy; 2025 Votly. All rights reserved.</small>
          </td>
        </tr>
      </table>
    </div>
  `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de confirmation envoyé à ${userEmail}`);
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email :", error);
  }
};

// ✅ Créer une session Stripe Checkout
const CheckOut = async (req, res) => {
  const { plan, userId, userEmail } = req.query; // Récupération des données

  try {
    console.log(plan, userId, userEmail);

    if (!plan || !userId) return res.status(400).send("Données invalides.");

    const priceId = Object.keys(priceIdToPlan).find(
      (id) => priceIdToPlan[id] === plan
    );
    if (!priceId) return res.status(400).send("Plan non valide.");

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });

    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({ email: user.email });

      await User.findByIdAndUpdate(
        userId,
        { stripeCustomerId: customer.id },
        { new: true, runValidators: false }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer: user.stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: "https://staging.votly.co/billinguser",
      metadata: {
        userId,
        plan, // ✅ Enregistre le plan sélectionné pour l'utiliser après le paiement
      },
    });

    console.log("Session Checkout créée:", session.url);
    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Erreur lors de la création de la session :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// ✅ Vérifier et enregistrer l'abonnement après le paiement réussi
const Success = async (req, res) => {
  const { session_id } = req.query;

  try {
    if (!session_id)
      return res.status(400).json({ error: "Session ID manquant." });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session) return res.status(400).json({ error: "Session invalide." });

    const user = await User.findOne({ stripeCustomerId: session.customer });
    if (!user)
      return res.status(404).json({ error: "Utilisateur non trouvé." });

    const subscription = await stripe.subscriptions.retrieve(
      session.subscription
    );
    const plan = session.metadata.plan || "Unknown";

    // 🔹 Vérifier si un abonnement actif existe déjà
    const currentSubscription = await SubscriptionDetails.findOne({
      id_user: user._id,
      status: "active",
    });

    if (currentSubscription) {
      console.log(
        `🔹 Annulation de l'ancien abonnement : ${currentSubscription.stripeSubscriptionId}`
      );

      // ✅ Annuler immédiatement l'ancien abonnement
      await stripe.subscriptions.cancel(
        currentSubscription.stripeSubscriptionId
      );

      // ✅ Mettre à jour l'ancien abonnement dans la base de données
      currentSubscription.status = "canceled";
      await currentSubscription.save();
    }
    console.log(user.email);
    // ✅ Enregistrer le nouvel abonnement en base de données
    const newSubscription = new SubscriptionDetails({
      id_user: user._id,
      stripeSubscriptionId: subscription.id,
      plan,
      status: subscription.status,
      startDate: new Date(subscription.current_period_start * 1000),
      endDate: new Date(subscription.current_period_end * 1000),
    });

    await newSubscription.save();
    // ✅ Envoi d'un email de confirmation à l'utilisateur
    await sendSubscriptionEmail(
      user?.email,
      plan,
      newSubscription.startDate,
      newSubscription.endDate,
      session.amount_total / 100 // Stripe envoie l'amount en centimes
    );

    console.log(`✅ Abonnement mis à jour pour ${user.email}`);
    res.redirect("https://staging.votly.co/pricing");
  } catch (err) {
    console.error("🔴 Erreur lors du traitement de la session :", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Rediriger vers le portail client Stripe pour gérer son abonnement
const Customer = async (req, res) => {
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: req.params.customerId,
      return_url: `${process.env.BASE_URL}/payment`,
    });

    res.redirect(portalSession.url);
  } catch (err) {
    console.error("Erreur Customer Portal :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// ✅ Webhook pour les paiements récurrents et les mises à jour d'abonnement
const Webhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET_KEY
    );

    console.log("🔹 Webhook reçu :", event.type);
  } catch (err) {
    console.error("Erreur Webhook :", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "invoice.payment_succeeded":
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;

        console.log("💰 Paiement réussi pour :", customerId, subscriptionId);

        const user = await User.findOne({ stripeCustomerId: customerId });
        if (!user)
          return res.status(404).json({ error: "Utilisateur non trouvé" });

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );
        const priceId = subscription.items.data[0].price.id;
        const plan = priceIdToPlan[priceId] || "Unknown";

        const updatedSubscription = await SubscriptionDetails.findOneAndUpdate(
          { stripeSubscriptionId: subscriptionId },
          {
            status: "active",
            endDate: new Date(subscription.current_period_end * 1000),
          },
          { new: true }
        );

        if (!updatedSubscription) {
          const newSubscription = new SubscriptionDetails({
            id_user: user._id,
            stripeSubscriptionId: subscription.id,
            plan,
            status: subscription.status,
            startDate: new Date(subscription.current_period_start * 1000),
            endDate: new Date(subscription.current_period_end * 1000),
          });
          await newSubscription.save();
        }

        user.plan = plan;
        await user.save();

        console.log(`✅ Paiement enregistré pour ${user.email}`);
        res.sendStatus(200);
        break;

      case "invoice.payment_failed":
        console.log("❌ Paiement échoué !");
        break;

      case "customer.subscription.updated":
        console.log("🔄 Abonnement mis à jour !");
        break;

      default:
        console.log(`🚀 Webhook non géré : ${event.type}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Erreur Webhook :", error.message);
    res.status(500).json({ error: "Erreur Webhook" });
  }
};
const getPlan = async (req, res) => {
  try {
    const { userId } = req.params;

    // 🔍 Chercher l'abonnement actif de l'utilisateur
    const subscription = await SubscriptionDetails.findOne({
      id_user: userId,
      status: "active",
      // Filtrer les abonnements actifs
    }).sort({ startDate: -1 }); // Prendre le plus récent si plusieurs abonnements

    if (!subscription) {
      return res
        .status(200)
        .json({ message: "Aucun abonnement actif", plan: "Free" });
    }

    // ✅ Retourner le plan actif
    res
      .status(200)
      .json({ plan: subscription.plan, endDate: subscription.endDate });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du plan utilisateur :",
      error
    );
    res.status(500).json({ error: "Erreur serveur." });
  }
};
const getHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await SubscriptionDetails.find({ id_user: userId }).sort({
      startDate: -1,
    });

    res.status(200).json({ history });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
module.exports = {
  CheckOut,
  Success,
  Customer,
  Webhook,
  getPlan,
  getHistory,
};
