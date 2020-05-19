var signToken = require("./auth").signToken;

exports.signin = function (req, res) {
  var access_token = signToken(req.user._id);
  res.status(200).json({
    message: "Signin successful!",
    data: {
      access_token,
      ...req.user.toJson(),
    },
  });
};
