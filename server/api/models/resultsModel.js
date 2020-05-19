var { Schema, model } = require("mongoose");

var ResultsSchema = new Schema({
  course: {
    type: Schema.Types.ObjectId,
    ref: "courses",
    required: true,
  },
  ca: {
    type: Number,
    max: 30,
    required: true,
    default: 0,
  },
  exam: {
    type: Number,
    max: 70,
    required: true,
    default: 0,
  },
  student: {
    type: Schema.Types.ObjectId,
    ref: "students",
    required: true,
  },
  year_submitted: {
    type: Number,
    required: true,
  },
  result_status: {
    type: Number,
    required: true,
    default: 1,
  },
});

module.exports = model("Results", ResultsSchema);
