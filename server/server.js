var express = require("express");
var app = express();
var api = require("./api/api");
var config = require("./config/config");

// db.url is different depending on NODE_ENV
require("mongoose").connect(config.db.url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//DB Seeding
if (config.seed) require("./utils/seed");

//Root message
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to resultify's api.",
    data: {
      auth: "goto /auth for everything login",
      api: "goto /api for core functionalities",
    },
  });
});

//Middleware stack
require("./middleware/appMiddleware")(app);

//API Routes
app.use("/api", api);
app.use("/auth", require("./auth/routes"));

//Error Handling
app.use(function (err, req, res, next) {
  if (err) {
    var statusCode = 500;
    if (err.name.toLowerCase().indexOf("unauthorized") !== -1) statusCode = 401;
    if (
      err.name.toLowerCase().indexOf("validation") !== -1 ||
      err.name.toLowerCase().indexOf("cast") !== -1
    )
      statusCode = 400;
    console.log(err.message);
    res.status(statusCode).json({
      message: err.message,
      data: {
        error: err._message,
        stack: err.stack,
      },
    });
  }
});

module.exports = app;
