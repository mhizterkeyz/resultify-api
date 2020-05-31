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

var users = [
  {
    name: "Mr. George McReynolds",
    username: "admin",
    password: "12345678",
    email: "george@gmail.com",
    user_role: "administrator",
    state_of_origin: "Kogi",
    lga: "Olamaboro",
    address: "Earth",
    phone: 234801112222,
  },
];
const invites = [
  {
    email: "jamal@gmail.com",
    role: "groupAdministrator",
    created_at: Date.now(),
    status: 3,
  },
];

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
  ].map(async (model) => {
    const content = await model.find();
    return content.map(async (elem) => elem.delete());
  });
  return Promise.all(cleanPromises);
};

cleanDb()
  .then(function (res) {
    User.create(users, function (err, user) {
      if (err) return logger.error(err.stack);
    });
    Promise.all(
      invites.map((e) =>
        Invites.create(e, (err) => {
          if (err) return logger.error(err.stack);
        })
      )
    );
  })
  .then(() =>
    (async () => {
      try {
        const groupAdministrator = await User.create({
          ...users[0],
          user_role: "groupAdministrator",
          username: "groupAdministrator",
          email: "group@gmail.com",
        });
        const group = await InstitutionalGroups.create({
          faculty: "natural sciences",
          department: "mathematical sciences",
          group_admin: groupAdministrator._id,
        });
        const lecturer_user = await User.create({
          ...users[0],
          user_role: "lecturer",
          username: "lecturer",
          email: "lecturer@gmail.com",
        });
        const lecturer = await Lecturers.create({
          personal_info: lecturer_user._id,
          group: group._id,
        });
        const student_user = await User.create({
          ...users[0],
          user_role: "student",
          username: "student",
          email: "student@gmail.com",
        });
        const date = new Date().getFullYear();
        const student = await Students.create({
          personal_data: student_user._id,
          group: group._id,
          matric: "16MS1001",
          entry_year: date,
          student_set: date,
        });
        const course = await Courses.create({
          course: "MAT 101",
          units: 3,
          title: "Fundamental mathematics I",
          added_by: group._id,
          semester: 1,
          level: 100,
          lecturer: lecturer._id,
        });
        const groupCourse = await GroupCourses.create({
          course: course._id,
          course_type: true,
          group: group._id,
          student_set: date,
        });
      } catch (e) {
        logger.error(e.stack);
      }
    })()
  )
  .catch(function (err) {
    logger.error(err.stack);
  });
