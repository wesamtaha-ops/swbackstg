
const entrepriseController = require('../controllers/entrepriseController');
const express = require('express');
const route = express.Router();



route.post('/create', entrepriseController.createEnterprise)

route.get('/getentreprisebyid/:id', entrepriseController.getEnterpriseById)
route.get('/getentreprisebyUserid/:id', entrepriseController.getEnterpriseByUserId)
route.get('/getTeambycompanyid/:id', entrepriseController.getTeamByEnterpriseId)
route.delete('/deletebyid/:id', entrepriseController.deleteEnterprise)
route.delete('/deletebyid/:id', entrepriseController.deleteEnterprise)

route.put('/updatebyid/:id', entrepriseController.updateEnterprise)



module.exports = route;