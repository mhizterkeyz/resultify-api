var morgan = require("morgan");
var bodyParser = require("body-parser");
var CORS = require("cors");
const validate = require("../../src/Components/landing/signup/validator");

module.exports = function (app) {
  app.use(morgan("dev"));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(CORS());

  app.use(function (req, res, next) {
    req.body.student_set = req.body.student_set || req.body.academic_set;
    req.body.invite_token = req.body.invite_token || req.body.invitation_code;
    req.body.name = req.body.name || req.body.fullname;
    req.validate = function (props) {
      var response = {};
      Object.keys(props).forEach(function (key) {
        var fieldProp = props[key].split("|");
        if (
          fieldProp.indexOf("required") !== -1 &&
          !req.body.hasOwnProperty(key)
        ) {
          response[key] = response.hasOwnProperty(key)
            ? " and is required"
            : `${key} is required`;
        }
        if (fieldProp.indexOf("required") !== -1)
          fieldProp.splice(fieldProp.indexOf("required"), 1);
        fieldProp.forEach(function (prop) {
          if (
            prop.toLowerCase() === "number" &&
            !isNaN(parseFloat(req.body[key]))
          )
            req.body[key] = parseFloat(req.body[key]);
          if (
            key === "email" &&
            typeof validate.email(req.body[key]) !== typeof true
          )
            response[key + "_"] = validate.email(req.body[key]);
          if (
            key === "username" &&
            typeof validate.username(req.body[key]) !== typeof true
          )
            response[key + "_"] = validate.username(req.body[key]);
          if (
            key === "password" &&
            typeof validate.password(req.body[key]) !== typeof true
          )
            response[key + "_"] = validate.password(req.body[key]);
          if (
            req.body.hasOwnProperty(key) &&
            typeof req.body[key] !== prop.toLowerCase()
          )
            response[key] = response.hasOwnProperty(key)
              ? `${response[key]} and must be ${
                  prop.toLowerCase() === "object" ? "an" : "a"
                } ${prop}`
              : `${key} must be ${
                  prop.toLowerCase() === "object" ? "an" : "a"
                } ${prop}`;
        });
      });
      if (Object.keys(response).length > 0) {
        res.status(400).json({
          message: "Invalid input!",
          data: response,
        });
        return false;
      }
      return true;
    };
    next();
  });
};
