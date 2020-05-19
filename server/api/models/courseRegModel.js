var { Schema, model } = require("mongoose");

var CourseRegSchema = new Schema({
  course: {
    type: Schema.Types.ObjectId,
    ref: "courses",
    required: true,
  },
  year_registered: {
    type: Number,
    required: true,
  },
  student: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "students",
  },
  reg_status: {
    type: Boolean,
    default: false,
    required: true,
  },
});

module.exports = model("course_regs", CourseRegSchema);
