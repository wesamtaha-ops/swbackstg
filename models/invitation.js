const mongoose = require('mongoose');

var invitationSchema = new mongoose.Schema({

    status: {
        type: String,
        enum: ["Pending", "accepted", "expired"],
        default: "Pending"

    },

    role: {

        type: String,
        required: true,
    },

    email: {
        type: String,
        required: true,

    },
    token: {
        type: String,
        required: true,

    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Entreprise',
        required: function () {
            return !this.workspace; 
        },
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: function () {
            return !this.company; 
        },
    },


    sender: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',

    },
    expiresAt: {
        type: Date,
        required: true,
        default: function () {
         // return new Date(Date.now() + 1 * 60 * 1000)
           return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
    }


},
    { timestamps: true },);


module.exports = mongoose.model('Invitation', invitationSchema);