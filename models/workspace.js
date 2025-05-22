const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var workspaceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    team: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
    }],
    companyOwner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Entreprise',
    },
    invitations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invitation',
        required: true,
    }],

},
    { timestamps: true },
);


module.exports = mongoose.model('Workspace', workspaceSchema);