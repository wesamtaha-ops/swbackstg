
const workspaceController = require('../controllers/workspaceController');
const express = require('express');
const Router = require("express").Router();



Router.post('/create', workspaceController.createWorkspace)

Router.post('/', workspaceController.createWorkspace);
Router.get('/getAll', workspaceController.getAllWorkspaces);
Router.get('/getAllByCompanyOwner/:id', workspaceController.getAllBycompanyOwner);
Router.get('/getById/:id', workspaceController.getWorkspaceById);
Router.put('/update/:id', workspaceController.updateWorkspace);
Router.delete('/delete/:id', workspaceController.deleteWorkspace);
Router.get('/getTeamByWorkspaceId/:id', workspaceController.getTeamByWorkspaceId)

module.exports = Router;

