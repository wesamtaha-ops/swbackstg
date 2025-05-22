const Workspace = require('../models/workspace');
const User = require('../models/user');
const Survey = require('../models/Survey');


module.exports = {
    // createWorkspace: async function (req, res) {
    //     try {
    //         const { name, companyOwner, forms, team } = req.body;

    //         if (!name) {
    //             return res.json({ message: 'Name is required', success: false });
    //         }

    //         const existingCompany = await Workspace.findOne({ name });

    //         if (existingCompany) {
    //             return res.status(400).json({ message: 'workspace name already exists', success: false });
    //         }
    //         else {


    //             const workspace = new Workspace({ name, companyOwner, forms, team });
    //             await workspace.save();

    //             res.status(201).json({ message: "Workspace créé avec succès", workspace });
    //         }
    //     } catch (error) {
    //         res.status(500).json({ error: error.message });
    //     }
    // },
    createWorkspace: async function (req, res) {
        try {
            const { name, companyOwner } = req.body;

            if (!name) {
                return res.json({ message: 'Name is required', success: false });
            }

            const existingWorkspace = await Workspace.findOne({ name });

            if (existingWorkspace) {
                return res.status(400).json({ message: 'workspace name already exists', success: false });
            }

            const workspace = new Workspace({ name, companyOwner });
            await workspace.save();

            res.status(201).json({ message: "Workspace created successfuly", data: workspace, success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error || "Server error", success: false });
        }
    },


    getAllWorkspaces: async function (req, res) {
        try {
            const workspaces = await Workspace.find().populate('companyId userId formId');
            res.status(200).json(workspaces);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    getAllBycompanyOwner: async function (req, res) {
        try {

            const workspaces = await Workspace.find({ companyOwner: req.params.id }).populate("team.userId", "username role").select('-invitations').lean();
            
         

            for (const workspace of workspaces) {
                workspace.surveyCount = await Survey.countDocuments({ workspaceId: workspace._id });

            }

            res.status(201).json({ message: "list of workspaces", workspaces: workspaces });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getWorkspaceById: async function (req, res) {
        try {
            const workspace = await Workspace.findById(req.params.id).populate('companyId userId formId');
            if (!workspace) return res.status(404).json({ message: "Workspace non trouvé" });

            res.status(200).json(workspace);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    updateWorkspace: async function (req, res) {
        try {


            const existingWorkspace = await Workspace.findOne({ name: req.body.name });

            if (existingWorkspace) {
                return res.status(400).json({ message: "Workspace name already exists", success: false });
            }

            const updatedWorkspace = await Workspace.findByIdAndUpdate(req.params.id, req.body, { new: true });

            if (!updatedWorkspace) {
                return res.status(404).json({ message: "Workspace not found", success: false });
            }

            res.status(200).json({ message: "Workspace updated successfully", updatedWorkspace });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    deleteWorkspace: async function (req, res) {
        try {
            const workspaceId = req.params.id;

            const workspace = await Workspace.findById(workspaceId);
            if (!workspace) {
                return res.status(404).json({ message: "Workspace non found" });
            }
            await User.updateMany(
                { workspaceId: workspaceId },
                { $set: { role: "user", workspaceId: null } }
            );
            await Workspace.findByIdAndDelete(workspaceId);

            res.status(200).json({ message: "Workspace deleted successfully, members have been retained with the 'user' role" });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },


    getTeamByWorkspaceId: async function (req, res) {
        try {
            const workspace = await Workspace.findById(req.params.id)
                .populate({
                    path: "team.userId",
                    select: "username email _id role isPermission"
                })
                .exec();

            if (!workspace) {
                return res.status(404).json({ message: "Workspace not found" });
            }


            const teamDetails = workspace.team.map(member => ({


                _id: member.userId._id,
                username: member.userId.username,
                email: member.userId.email,
                role: member.userId.role,
                isPermission: member.userId.isPermission
            }));

            return res.status(200).json({ message: "Team found", team: teamDetails });

        } catch (error) {
            console.error("Error in getTeamByWorkspaceId:", error);
            res.status(500).json({ message: error.message });
        }
    }




}