const Enterprise = require('../models/entreprise');
const User = require('../models/user')
const emailService = require('../middleware/sendMailInvitation');
const entreprise = require('../models/entreprise');
module.exports = {
    createEnterprise: async function (req, res) {
        try {
            const { name, Owner } = req.body;

            if (!name) {
                return res.status(400).json({ message: 'Name is required', success: false });
            }

            const existingCompany = await Enterprise.findOne({ name });

            if (existingCompany) {
                return res.status(400).json({ message: 'Company name already exists', success: false });
            }


            const enterprise = new Enterprise({
                name,
                Owner
            });

            await enterprise.save();
            const user = await User.findById(Owner);
            if (!user) {
                return res.status(404).json({ msg: "Utilisateur non trouvé", success: true });
            }
            // update role user
            user.role = "accountOwner";
            await user.save();

            res.status(201).json({
                message: 'Company created successfully',
                success: true,
                data: enterprise
            });
        } catch (error) {

            res.status(500).json({ message: error || "server error" });
        }
    }
    ,


    updateEnterprise: async function (req, res) {
        try {
            const { name } = req.body;

            const existingEnterprise = await Enterprise.findOne(name);

            if (existingEnterprise) {
                return res.status(400).json({ message: "Company name already exists", success: false });
            }


            const enterprise = await Enterprise.findByIdAndUpdate(req.params.id, req.body, { new: true });

            if (!enterprise) {
                return res.status(404).json({ message: "Enterprise not found", success: false });
            }

            res.status(200).json({ message: "Enterprise updated successfully", enterprise });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    deleteEnterprise: async function (req, res) {
        try {
            const enterprise = await Enterprise.findById(req.params.id);
            if (!enterprise) {
                return res.status(404).json({ message: "Enterprise not found" });
            }

            await User.updateMany(
                { companyId: enterprise._id },
                { $set: { role: "user", companyId: null } }
            );


            await Enterprise.findByIdAndDelete(req.params.id);

            res.status(200).json({ message: "Enterprise deleted successfully, members have been retained with the 'user' role." });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },


    getEnterpriseById: async function (req, res) {
        try {
            const entreprise = await Enterprise.findById(req.params.id).populate("Owner", "_id username email");

            res.status(200).json({ message: 'Enterprise details', entreprise });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    getEnterpriseByUserId: async function (req, res) {
        try {

            const entreprise = await Enterprise.find({ Owner: req.params.id }).populate("team.userId", "username role").populate("workspaces.forms").select('-invitations');

            res.status(200).json(entreprise);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
    getTeamByEnterpriseId: async function (req, res) {
        try {
            const enterprise = await Enterprise.findById({ _id: req.params.id })
                .populate({
                    path: "team.userId",
                    select: "username email role isPermission"
                })
                .exec();


            if (!enterprise) {
                return res.status(404).json({ message: "Enterprise not found" });
            }


            const formattedTeam = enterprise.team.map(member => ({
                _id: member.userId._id,
                username: member.userId.username,
                email: member.userId.email,
                role: member.userId.role,
                isPermission: member.userId.isPermission,
            }));

            return res.status(200).json({ message: "Team found", team: formattedTeam });

        } catch (error) {
            console.error("Error in getTeamByEnterpriseId:", error);
            res.status(500).json({ message: error.message });
        }
    }
    ,

    // getTeamByEntrepriseId: async function (req, res) {
    //     try {


    //         const entreprise = await Enterprise.findById(req.params.id)
    //             .populate("team.userId", "username email role")
    //             .exec();

    //         const team = entreprise.team


    //         return res.status(200).json({ message: 'team found', team:team });

    //     } catch (error) {
    //         res.status(500).json({ message: error.message });
    //     }
    // },


    deleteMemberByEntreprise: async function (req, res) {

        try {
            const { userId } = req.params;


            const teamMember = entreprise.team.find(m => m.userId.toString() === userId);
            if (!teamMember) return res.status(404).json({ message: "Membre non trouvé" });

            const memberRole = teamMember.role;


            if (memberRole === "admin") {
                const otherAdmins = entreprise.team.filter(m => m.role === "admin" && m.userId.toString() !== userId);
                if (otherAdmins.length === 0) {
                    return res.status(400).json({ message: "Impossible de supprimer l'admin sans transfert de rôle" });
                }
            }


            entreprise.team = entreprise.team.filter(m => m.userId.toString() !== userId);
            await entreprise.save();

            return res.status(200).json({ message: "Membre supprimé avec succès" });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Erreur serveur" });
        }
    }







}