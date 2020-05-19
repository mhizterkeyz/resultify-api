var router = require("express").Router();
var controller = require("./controller");

router.use(controller.me(false, true), controller.groupOptions());

/**
 * Course Operations
 */
router.route("/courses").get(controller.courses());
router
  .route("/courses/reg")
  .get(controller.getCourseReg())
  .post(
    controller.courses(true),
    require("../groupAdministrators/controller").extractCourse(),
    controller.getCourseReg(true),
    controller.regCapChecker(),
    controller.courseReg
  );
router
  .route("/courses/reg/:id")
  .delete(controller.deleteCoureReg)
  .put(controller.saveCourseReg);

/**
 * Result Operations
 */
router.route("/results").get(controller.get_results());

/**
 * Notifications Operation
 */
router
  .route("/notifications")
  .get(require("../lecturers/controller").notifications);
router
  .route("/notifications/:id")
  .get(require("../lecturers/controller").notifications);

/**
 * Operation on self
 */
router
  .route("/me")
  .get(controller.me())
  .put(controller.updateStudent, controller.me(true));

module.exports = router;
