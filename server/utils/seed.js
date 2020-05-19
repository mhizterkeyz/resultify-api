var User = require("../api/models/usersModel");
var AppOptions = require("../api/models/appOptionsModel");
var CourseReg = require("../api/models/courseRegModel");
var Courses = require("../api/models/coursesModel");
var GroupCourses = require("../api/models/groupCoursesModel");
var GroupOptions = require("../api/models/groupOptionsModel");
var InstitutionalGroups = require("../api/models/institutionalGroupsModel");
var Invites = require("../api/models/invitesModel");
var Lecturers = require("../api/models/lecturersModel");
var Notifications = require("../api/models/notificationModel");
var Results = require("../api/models/resultsModel");
var Students = require("../api/models/StudentsModel");
var _ = require("lodash");
var logger = require("./logger");

logger.log("Seeding the database");

var user = {
  name: "Mr. George McReynolds",
  username: "admin",
  password: "12345678",
  email: "george@gmail.com",
  user_role: "administrator",
  state_of_origin: "Kogi",
  lga: "Olamaboro",
  address: "Earth",
  phone: 234801112222,
};

var cleanDb = function () {
  logger.log("...cleaning the DB");
  var cleanPromises = [
    User,
    AppOptions,
    CourseReg,
    Courses,
    GroupCourses,
    GroupOptions,
    InstitutionalGroups,
    Invites,
    Lecturers,
    Notifications,
    Results,
    Students,
  ].map(function (model) {
    return model.deleteOne().exec();
  });
  return Promise.all(cleanPromises);
};

cleanDb()
  .then(function (res) {
    User.create(user, function (err, user) {
      if (err) return logger.error(err.stack);
      logger.log("DB seeded with an administrator");
    });
  })
  .catch(function (err) {
    logger.error(err.stack);
  });
