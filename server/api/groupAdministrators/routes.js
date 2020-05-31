var router = require("express").Router();
var Controller = require("./controller");

router.use(Controller.getAssignedGroups(true), Controller.EFAD());

/**
 * Invites routes
 */
router.route("/invites").get(Controller.getInvites).post(Controller.newInvite);
router
  .route("/invites/:invite_id")
  .get(Controller.getOneInvite)
  .delete(Controller.deleteInvite);

/**
 * Group Routes
 */
router.route("/groups").get(Controller.getAssignedGroups());
router
  .route("/groups/courses")
  .get(Controller.getGroupCourses)
  .post(Controller.extractCourse(), Controller.createGroupCourse);
router
  .route("/groups/courses/:id")
  .get(Controller.getOneGroupCourse())
  .put(
    Controller.extractCourse(),
    Controller.getOneGroupCourse(true),
    Controller.updateGroupCourse
  )
  .delete(Controller.getOneGroupCourse(true), Controller.deleteGroupCourse);
router.route("/groups/:id").get(Controller.getOneGroup);
router
  .route("/groupoptions")
  .get(Controller.getAllGroupDefaults)
  .post(Controller.EFAD(true), Controller.newGroupDefault());
router
  .route("/groupoptions/:id/:set")
  .get(Controller.getGroupDefault())
  .put(Controller.getGroupDefault(true), Controller.updateGroupDefault);

/**
 * Lecturer Operations
 */
router.route("/lecturers").get(Controller.getLecturers);
router
  .route("/lecturers/:id")
  .get(Controller.getOneLecturer)
  .delete(Controller.deleteLecturer)
  .put(Controller.unblockLecturer);

/**
 * Student Operations
 */
router.route("/students").get(Controller.getStudents);
router
  .route("/students/:id")
  .get(Controller.studentParamRoute, Controller.getOneStudent)
  .delete(Controller.studentParamRoute, Controller.deleteStudent)
  .put(Controller.studentParamRoute, Controller.updateStudent);

/**
 * Course Operations
 */
router.route("/courses").get(Controller.getCourses).post(Controller.addCourse);
router
  .route("/courses/:id")
  .get(Controller.getOneCourse())
  .delete(Controller.getOneCourse(true), Controller.deleteCourse)
  .put(Controller.getOneCourse(true), Controller.updateCourse);

/**
 * Result Operations
 */
router
  .route("/results")
  .get(Controller.get_results())
  .delete(
    Controller.extractCourse(),
    Controller.reject_result,
    Controller.get_results("Result rejected for reanalysis")
  )
  .put(
    Controller.save_result,
    Controller.get_results("Result sent for review")
  );

/**
 * Group Administrator's Routes
 */
router
  .route("/me")
  .get(function (req, res) {
    res.status(200).json({
      message: "",
      data: req.user.toJson(),
    });
  })
  .put(Controller.updateAdmin);
router.route("/notifications").get(Controller.notifications);
router.route("/notifications/:id").get(Controller.notifications);

module.exports = router;
