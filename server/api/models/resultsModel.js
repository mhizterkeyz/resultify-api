var { Schema, model } = require("mongoose");

var ResultsSchema = new Schema({
  course: {
    type: Schema.Types.ObjectId,
    ref: "courses",
    required: true,
  },
  ca_1: {
    type: Number,
    max: 10,
    required: true,
    default: 0,
  },
  ca_2: {
    type: Number,
    max: 10,
    required: true,
    default: 0,
  },
  ca_3: {
    type: Number,
    max: 10,
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
