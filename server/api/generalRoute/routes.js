const router = require("express").Router();
const controller = require("./controller");
const { decodeToken, getFreshUser } = require("../../auth/auth");

router.get("/verifyinvite/:id", controller.verify_inivite());
router.get("/groups", controller.get_groups());
router.get("/verify_access_token", decodeToken(), getFreshUser(), function (
  req,
  res
) {
  res.status(200).json({ message: "", data: req.user.toJson() });
});
router.get("/verify_cred/:id", controller.verify_cred());

module.exports = router;
