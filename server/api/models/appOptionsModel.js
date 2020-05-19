var { Schema, model } = require("mongoose");

var AppOptionsSchema = new Schema({
  semester: {
    type: Number,
    required: true,
  },
  academic_year: {
    type: Number,
    required: true,
  },
});

module.exports = model("app_options", AppOptionsSchema);
