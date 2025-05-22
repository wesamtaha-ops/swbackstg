
const Invitation = require('../models/invitation');
const Workspace = require('../models/workspace');
const Enterprise = require('../models/entreprise');
const User = require('../models/user');
const crypto = require('crypto');

const { sendInvitationEmail } = require('../middleware/sendMailInvitation');




module.exports = {
    sendInvitation: async function (req, res, next) {
        try {
            const { email, company, workspace, role, sender } = req.body;

            // Find company/workspace
            let entity = null;
            let nameEntity = '';
            let entityType = "";

          
            if (company) {
                entity = await Enterprise.findById(company).populate('team.userId');
                nameEntity = 'company';
                entityType = 'company';
            } else if (workspace) {
                entity = await Workspace.findById(workspace).populate('team.userId');
                nameEntity = 'workspace';
                entityType = 'workspace';
            }

            if (!entity) {
                return res.status(400).json({
                    message: `${nameEntity} not found`
                });
            }

            // Verify if there is already a "companyOwner" or "workspaceOwner"
            const existingOwner = entity.team.find(member => member.userId.role === (entityType === "company" ? "companyOwner" : "workspaceOwner"));


            if (existingOwner && (role === "companyOwner" || role === "workspaceOwner")) {
                return res.status(400).json({
                    message: `This ${nameEntity} already has a ${role}. You cannot have more than one.`
                });
            }

            // Verify if there's already a pending invitation for the same email
            const senderPendingInvitation = await Invitation.findOne({
                email,
                status: "Pending",
                sender: sender
            });

            if (senderPendingInvitation) {
                return res.status(400).json({
                    message: "You already have a pending invitation for this email."
                });
            }

            // Check if the user is already a member of the company/workspace
            const existingUser = await User.findOne({ email });
            const isAlreadyMember = existingUser && entity.team.some(member =>
                member.userId && member.userId.toString() === existingUser._id.toString()
            );

            if (isAlreadyMember) {
                return res.status(400).json({
                    message: `This user is already a member of this ${nameEntity}`
                });
            }

            // Check if the user has a role in another company
            if (existingUser && existingUser.role !== 'user') {
                return res.status(400).json({
                    message: 'This user is already a member of another company.'
                });
            }

            // Generate unique token for the invitation
            const token = crypto.randomBytes(32).toString('hex');

            // Create the invitation object
            const invitation = new Invitation({
                email,
                role,
                sender,
                token,
                // expiresAt: new Date(Date.now() + 1 * 60 * 1000), // Expires in 1 minute

               expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
                company: company || null,
                workspace: workspace || null,
            });

            await invitation.save();

            if (!entity.invitations) {
                entity.invitations = [];
            }

            entity.invitations.push(invitation._id);
            await entity.save();

            // Send the invitation email
            await sendInvitationEmail(email, entity.name, role, token);

            res.json({
                message: "Invitation sent successfully",
                invitation: {
                    id: invitation._id,
                    email: invitation.email,
                    role: invitation.role,
                    company: invitation.company,
                    workspace: invitation.workspace,
                },
                status: 201
            });

        } catch (error) {
            console.error("Error in sendInvitation:", error);
            res.status(500).json({
                message: "An error occurred while sending the invitation: " + error,
                error: error.message
            });
        }
    }
    ,

    resendInvitation: async function (req, res) {

        try {
            const { email, company, workspace, role, sender ,invitationId } = req.body;
       

            const invitation = await Invitation.findById(invitationId);

            if (!invitation) {
                return res.status(404).json({ message: "Invitation non trouvée." });
            }

            if (new Date() < new Date(invitation.expiresAt)) {
                return res.status(400).json({ message: "L'invitation n'est pas encore expirée." });
            }

            invitation.status = "Pending";
            invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

            await invitation.save();

            await sendInvitationEmail(invitation.email, "Entreprise/Workspace", invitation.role, invitation.token);

            return res.json({
                message: "Invitation renvoyée avec succès.",
                invitation,
                status: 200
            });

        } catch (error) {
            console.error("Erreur lors du renvoi de l'invitation :", error);
            res.status(500).json({ message: "Erreur serveur." });
        }
    },





    acceptInvitation: async function (req, res) {
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ message: "Token is required" });
            }
            const invitation = await Invitation.findOne({ token, status: 'Pending' })
                .populate('company')
                .populate('workspace');

            if (!invitation) {
                return res.status(400).json({ message: 'Invalid or expired invitation' });
            }

            // Verified pending  invit
            if (new Date() > invitation.expiresAt) {
                invitation.status = "expired";
                await invitation.save();
                return res.status(400).json({ message: "This invitation has expired", status: "expired" });
            }

            const email = invitation.email;
            let user = await User.findOne({ email });

            if (!user) {
                return res.status(200).json({
                    message: 'User does not exist. Redirecting to register',
                    redirectUrl: 'http://localhost:5173/signup',
                    email: email,
                    role: invitation.role,
                    entityId: invitation.company ? invitation.company._id : invitation.workspace._id,
                    entityType: invitation.company ? "company" : "workspace",
                });
            }

            user.role = invitation.role;
            user.companyId = invitation.company && invitation.company._id
            user.workspaceId = invitation.workspace && invitation.workspace._id;


            await user.save();


            let entity = invitation.company ? await Enterprise.findById(invitation.company._id)
                : await Workspace.findById(invitation.workspace._id);

            if (!entity) {
                return res.status(404).json({ message: 'Enterprise or Workspace not found' });
            }

            const isAlreadyMember = entity.team.some(member =>
                member.userId && member.userId.toString() === user._id.toString()
            );

            if (!isAlreadyMember) {
                entity.team.push({ userId: user._id });
                await entity.save();
            }

            invitation.status = 'accepted';
            await invitation.save();

            // const updatedEntity = await (invitation.company
            //     ? Enterprise.findById(invitation.company._id).populate('team.userId')
            //     : Workspace.findById(invitation.workspace._id).populate('team.userId'));

            return res.status(200).json({
                message: 'Invitation accepted successfully. Redirecting to login.',
                redirectUrl: 'http://localhost:5173/login',
                entityId: invitation.company ? invitation.company._id : invitation.workspace._id

                ,
                entityType: invitation.company ? "company" : "workspace",
            });


        } catch (error) {
            console.error('Error in acceptInvitation:', error);
            return res.status(500).json({ message: error.message });
        }
    },


    getInvitationbyToken: async function (req, res) {

        try {
            const { token } = req.params;


            const invitation = await Invitation.findOne({ token });

            if (!invitation) {
                return res.status(404).json({ msg: "Invitation invalide ou expirée." });
            }

            if (new Date() > invitation.expiresAt) {
                invitation.status = 'expired';
                await invitation.save();
            }
            res.json({
                email: invitation.email,
                companyId: invitation.company,
                workspaceId: invitation.workspace,
                role: invitation.role,
                status: invitation.status,
                expiresAt: invitation.expiresAt
            });



        } catch (error) {
            res.status(500).json({ msg: "Erreur serveur." });
        }
    },


    getInvitationById: async function (req, res) {

        try {

            const invit = await Invitation.find(req.params.id);

            if (!invit || invit.length === 0) {
                return res.status(404).json({ message: 'No invit found ' });
            }

            res.status(200).json({ message: 'invit found : ', invit });

        } catch (error) {

            res.status(500).json({ message: 'error', error: error.message });

        }
    },

    getInvitationbyCompanyId: async function (req, res) {

        try {

            const invit = await Invitation.find({ company: req.params.id });

            if (!invit || invit.length === 0) {
                return res.status(404).json({ message: 'No invit found for the user' });
            }

            res.status(200).json({ message: 'invit found : ', invit });

        } catch (error) {

            res.status(500).json({ message: 'error', error: error.message });

        }
    },



    getInvitationbySenderId: async function (req, res) {
        try {
            const invit = await Invitation.find({ sender: req.params.id }).populate("company", "name").populate("workspace", "name").exec();

            const invitationsWithStatus = await Promise.all(invit.map(async invitation => {
                const expirationDate = new Date(invitation.expiresAt);
                const currentDate = new Date();
                const isExpired = currentDate > expirationDate;

                //  update of status if invit expired
                if (isExpired && invitation.status === "Pending") {
                    invitation.status = "expired";
                    await invitation.save();
                }

                return {
                    ...invitation.toObject(),
                    isExpired,
                };
            }));


            res.status(200).json({ message: 'invit found : ', invitationsWithStatus });


        } catch (error) {
            console.error('Error in getInvitationbySenderId:', error);
            res.status(500).json({ message: 'Error retrieving invitations', error: error.message });
        }
    },


    deleteInvitationById: async function (req, res) {
        try {

            const existingInvit = await Invitation.findByIdAndDelete(req.params.id);
            if (!existingInvit) {
                return res.status(400).json({ message: 'invitation not found' });
            }

            await Invitation.findByIdAndDelete({ _id: req.params.id });

            res.json({ message: 'Invitation deleted successfully', status: 201 });
        } catch (error) {

            res.status(500).json({ message: 'An error occurred while deleting the Invitation', error: error.message });

        }
    },

}