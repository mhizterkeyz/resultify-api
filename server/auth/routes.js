var controller = require("./controller");
var router = require("express").Router();
var VerifyUser = require("./auth").verifyUser;

router.post("/signin", VerifyUser(), controller.signin);

module.exports = router;
