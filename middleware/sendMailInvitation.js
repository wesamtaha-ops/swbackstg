const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendInvitationEmail = async (recipientEmail, enterpriseName, roleName, token) => {
    const invitationLink = `${process.env.BASE_URL_FRONT}/accept-invitation?token=${token}`;

    const templatePath = path.join(__dirname, 'invitationTemplate.html');

    let htmlContent = fs.readFileSync(templatePath, 'utf-8');

    htmlContent = htmlContent.replace(/{{enterpriseName}}/g, enterpriseName)
        .replace(/{{roleName}}/g, roleName)
        .replace(/{{invitationLink}}/g, invitationLink)
        .replace(/{{logoUrl}}/g, 'cid:logo'); 


    const subject = `Invitation to join ${enterpriseName} as ${roleName}`;

    const logoPath = path.join(__dirname, '../images/logo.png');

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        attachments: [
            {
                filename: 'logo.png',
                path: logoPath,
                cid: 'logo' 
            }
        ]
    };

    try {
        await transporter.sendMail(mailOptions);
      
    } catch (error) {
        console.error('Error sending invitation email:', error);
        throw new Error('Failed to send invitation email', error);
    }
};

module.exports = { sendInvitationEmail };
