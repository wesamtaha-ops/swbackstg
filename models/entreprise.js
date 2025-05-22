const mongoose = require('mongoose');

const entrepriseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },

    Owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    invitations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invitation',
        required: true,
    }],



    // added after registration 
    team: [{
        userId: { type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' },
    

    }],
    workspaces: [{
        type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace' ,
    

    }]


}, { timestamps: true });

module.exports = mongoose.model('Entreprise', entrepriseSchema);
