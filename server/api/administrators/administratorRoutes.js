var router = require("express").Router();
var Controller = require("./administratorController");

router.use(require("../groupAdministrators/controller").EFAD(true, true));

/**
 * Invites routes
 */
router.route("/invites").get(Controller.getInvites).post(Controller.newInvite);
router
  .route("/invites/:invite_id")
  .get(Controller.getOneInvite)
  .delete(Controller.deleteInvite)
  .put(Controller.updateInvite);

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
 * Result Operations
 */
router
  .route("/results")
  .get(Controller.get_results())
  .delete(
    require("../groupAdministrators/controller").extractCourse(),
    Controller.reject_result,
    Controller.get_results("Result rejected for reanalysis")
  )
  .put(Controller.save_result, Controller.get_results("Result approved"));

/**
 * GroupRoutes
 */
router.route("/groups/admins").get(Controller.getGroupAdmins);
router
  .route("/groups/admins/:id")
  .get(
    Controller.adminRoute,
    Controller.routeProtect("groupAdministrator"),
    Controller.getOneAdmin
  )
  .delete(
    Controller.adminRoute,
    Controller.routeProtect("groupAdministrator"),
    Controller.deleteAdmin
  );
router.route("/groups").get(Controller.getGroups).post(Controller.addGroup);
router
  .route("/groups/:id")
  .get(Controller.groupRoute, Controller.getOneGroup)
  .put(Controller.groupRoute, Controller.updateGroup)
  .delete(Controller.groupRoute, Controller.deleteGroup);

/**
 * App options
 */
router
  .route("/options")
  .get(function (req, res) {
    return res.status(200).json({ message: "", data: req.app_defaults });
  })
  .put(function (req, res, next) {
    req.validate({ semester: "number", academic_year: "number" }) &&
      req.app_defaults.update(req.body, function (err, updated) {
        if (err) return next(err);
        next();
      });
  }, Controller.appDefaults(true, "Options updated!"));

/**
 * Administrator Routes
 */
router.route("/").get(Controller.getAppAdmins);
router
  .route("/me")
  .get(function (req, res) {
    res.status(200).json({
      message: "",
      data: req.user.toJson(),
    });
  })
  .put(Controller.updateAdmin);
router
  .route("/:id")
  .get(
    Controller.adminRoute,
    Controller.routeProtect("administrator"),
    Controller.getOneAdmin
  );

module.exports = router;
