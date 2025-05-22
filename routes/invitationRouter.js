
const invitationController = require('../controllers/invitationController');
const express = require('express');
const route = express.Router();



route.post('/invite', invitationController.sendInvitation);
route.post('/resend', invitationController.resendInvitation);
route.post('/accept', invitationController.acceptInvitation);
// route.delete('/deleteByCompanyId/:id', invitationController.deleteInvitationByCompanyId)
route.get('/getByCompanyId/:id', invitationController.getInvitationbyCompanyId)
route.get('/getByToken/:token', invitationController.getInvitationbyToken)
route.get('/getbySenderId/:id', invitationController.getInvitationbySenderId)

route.delete('/deletebyid/:id', invitationController.deleteInvitationById)




module.exports = route;