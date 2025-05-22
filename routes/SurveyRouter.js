const express = require("express");
const Router = require("express").Router();
const {
  CreateSurvey,
  UpdateSurvey,
  GetAllSurveys,
  GetSurveyById,
  SubmitSurveyRequest,
  AllSurveyResponses,
  GetAllSurveysVersions,
  GetSurveyVersionBySurveyId,
  BackupSurveyVersion,
  UpdateSurveyVersion,
  PublishSurvey,
  GetSurveyByUser,
  GenerateQuestion,
  GetSurveyByWorkspaceId,
  GetAverageTime,
  UpdateProgressByUser,
  CheckProgressByUser,
  CheckCompletionBySurvey,
  VerifiyProgressByUser,
  getSurveyResponseCount,
  getSurveyStats,
  RetargetSurvey,
  getStatusSurvey,
  closeSurvey,
  statsCompany,
} = require("../controllers/survey.controllers.js");

Router.post("/create_survey", CreateSurvey);
Router.put("/update_survey/:id", UpdateSurvey);
Router.get("/surveys", GetAllSurveys);
Router.get("/getsurvey/:id", GetSurveyById);
Router.get("/getsurveyByUserId/:userId", GetSurveyByUser);
Router.post("/submit_survey/:id/response", SubmitSurveyRequest);
Router.get("/submit_survey/responses/:id", AllSurveyResponses);
Router.get("/survey_versions/versions/:id", GetAllSurveysVersions);
Router.get("/survey_version/version/:surveyId", GetSurveyVersionBySurveyId);
Router.put("/backup_survey_version/restore/:versionId", BackupSurveyVersion);
Router.put(
  "/update_survey_version/version/edit/:versionId",
  UpdateSurveyVersion
);
Router.post("/publish_survey/:id", PublishSurvey);
Router.get("/user/survey/:workspaceId", GetSurveyByWorkspaceId);
Router.post("/survey/generate_question", GenerateQuestion);
Router.get("/survey/average_time/:id", GetAverageTime);
Router.post("/survey/update_progress", UpdateProgressByUser);
Router.get("/survey/progress/:surveyId/:userEmail", CheckProgressByUser);
Router.get("/surveys/completion/:surveyId", CheckCompletionBySurvey);
Router.get("/survey/get_progress/:surveyId/:userEmail", VerifiyProgressByUser);
Router.get("/survey/:surveyId/response-count", getSurveyResponseCount);
Router.get("/survey/:surveyId/stats", getSurveyStats);
Router.post("/retarget_survey", RetargetSurvey);
Router.get("/survey/:surveyId/status", getStatusSurvey);
Router.put("/close_survey/:surveyId/close", closeSurvey);
Router.get("/company/stats/:companyId", statsCompany);

module.exports = Router;
