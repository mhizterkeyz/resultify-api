const router = require("express").Router();
const controller = require("./controller");

router.use(controller.me(true), controller.getAssingedCourses());

/**
 * Operations on scoresheet
 */
router
  .route("/scoresheets")
  .get(
    require("../groupAdministrators/controller").extractCourse(),
    controller.getScoreSheet()
  )
  .put(
    require("../groupAdministrators/controller").extractCourse(),
    controller.saveScoreSheet,
    controller.getScoreSheet("Record saved!")
  );
router.route("/scoresheets/:id").put(controller.updateScoreSheet);

/**
 * Notifications Operation
 */
router.route("/notifications").get(controller.notifications);
router.route("/notifications/:id").get(controller.notifications);

/**
 * Operations on self
 */
router
  .route("/me")
  .get((req, res) => res.status(200).json({ message: "", data: req.lecturer }))
  .put(controller.updateLecturer, controller.me(false, "Account updated!"));
router
  .route("/assigned")
  .get((req, res) =>
    res.status(200).json({ message: "", data: req.assinged_courses })
  );

module.exports = router;
