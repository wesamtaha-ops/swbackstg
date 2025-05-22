const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

});

const sendVerificationEmail = async (email, verificationToken) => {
  const verificationLink = `https://swbackstg.vercel.app/user/verify/${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Check your Volty account',
    html: `
        <h1>Welcome to Volty!</h1>
        <p>Thank you for registering. To activate your account, please click on the link below:</p>
        <a href="${verificationLink}">verify my account</a>
        <p>This link will expire in 24 hours.</p>
        <p>If you have not created an account, you can ignore this email.</p>
      `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return false;
  }
};

const sendResetPasswordEmail = async (email, resetToken) => {
  const resetLink = `http://localhost:5173/reset-password/${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Réinitialisation de votre mot de passe Volty',
    html: `
            <h1>Password reset</h1>
            <p>You have requested a password reset.</p>
            <p>Click the link below to set a new password:</p>
            <a href="${resetLink}">Reset my password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this reset, ignore this email.</p>
        `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return false;
  }
};







module.exports = {
  sendVerificationEmail,
  sendResetPasswordEmail
};









