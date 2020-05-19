var config = require("./config/config");
var app = require("./server");
var logger = require("./utils/logger");

app.listen(config.port, function () {
  logger.log(`Listening on http://localhost:${config.port}`);
});
