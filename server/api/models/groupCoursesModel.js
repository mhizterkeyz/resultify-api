var { Schema, model } = require("mongoose");

var GroupCoursesSchema = new Schema({
  course: {
    type: Schema.Types.ObjectId,
    ref: "courses",
    required: true,
  },
  status: {
    type: Boolean,
    required: true,
    default: true,
  },
  course_type: {
    type: Boolean,
    default: true,
    required: true,
  },
  group: {
    type: Schema.Types.ObjectId,
    ref: "institutional_groups",
    required: true,
  },
  student_set: {
    type: Number,
    required: true,
  },
});

module.exports = model("group_courses", GroupCoursesSchema);
