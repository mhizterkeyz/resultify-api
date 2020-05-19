var router = require("express").Router();
var { decodeToken, getFreshUser } = require("../auth/auth");

function routeProtect(criteria) {
  return function (req, res, next) {
    if (req.user.user_role !== criteria)
      return res.status(403).json({
        message: "You don't have enough permission for this operation",
        data: {},
      });
    next();
  };
}

router.use(require("./administrators/administratorController").appDefaults());

/**
 * Signup Routes
 */
router.post(
  "/administrator",
  require("./groupAdministrators/controller").EFAD(true),
  require("./administrators/administratorController").createAppAdmin
);
router.post(
  "/groupadministrator",
  require("./groupAdministrators/controller").EFAD(true),
  require("./groupAdministrators/controller").createGroupAdmin
);
router.post(
  "/student",
  require("./groupAdministrators/controller").EFAD(true),
  require("./students/controller").createStudent
);
router.post(
  "/lecturer",
  require("./groupAdministrators/controller").EFAD(true),
  require("./lecturers/controller").createLecturer
);

/**
 * Crud routes
 */
router.use(
  "/administrator",
  decodeToken(),
  getFreshUser(),
  routeProtect("administrator"),
  require("./administrators/administratorRoutes")
);
router.use(
  "/groupadministrator",
  decodeToken(),
  getFreshUser(),
  routeProtect("groupAdministrator"),
  require("./groupAdministrators/routes")
);
router.use(
  "/student",
  decodeToken(),
  getFreshUser(),
  routeProtect("student"),
  require("./students/routes")
);
router.use(
  "/lecturer",
  decodeToken(),
  getFreshUser(),
  routeProtect("lecturer"),
  require("./lecturers/routes")
);

router.use("/", require("./generalRoute/routes"));

module.exports = router;
