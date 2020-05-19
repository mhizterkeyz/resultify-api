var jwt = require("jsonwebtoken");
var expressJwt = require("express-jwt");
var config = require("../config/config");
var checkToken = expressJwt({ secret: config.secrets.jwt });
var User = require("../api/models/usersModel");

exports.decodeToken = function () {
  return function (req, res, next) {
    if (req.query && req.query.hasOwnProperty("access_token"))
      req.headers.authorization = "Bearer " + req.query.access_token;

    checkToken(req, res, next);
  };
};

exports.getFreshUser = function () {
  return function (req, res, next) {
    User.findById(req.user.data._id).then(
      function (user) {
        if (!user)
          return res.status(401).json({
            message: "You can't access this resource!",
            data: {},
          });
        req.user = user;
        next();
      },
      function (err) {
        next(err);
      }
    );
  };
};

exports.verifyUser = function () {
  return function (req, res, next) {
    var username = req.body.username;
    var password = req.body.password;
    if (!username || !password)
      return res.status(400).json({
        message: "Username and password is required",
        data: {},
      });
    User.findOne({ $or: [{username}, {email: username}] }).then(
      function (user) {
        if (!user)
          return res.status(401).json({
            message: "Invalid credentials",
            data: {},
          });

        if (!user.authenticate(password))
          return res.status(401).json({
            message: "Invalid credentials",
            data: {},
          });
        req.user = user;
        next();
      },
      function (err) {
        next(err);
      }
    );
  };
};

exports.signToken = function (id) {
  return jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + config.expireTime,
      data: { _id: id },
    },
    config.secrets.jwt
  );
};
