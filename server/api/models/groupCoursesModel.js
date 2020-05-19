var { Schema, model } = require("mongoose");

var GroupCoursesSchema = new Schema({
  course: {
    type: Schema.Types.ObjectId,
    ref: "courses",
    required: true,
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

GroupCoursesSchema.methods = {
  toJson: function () {
    var res = this.toObject();
    res.course_type = res.course_type ? "CORE" : "ELECTIVE";
    return res;
  },
};

module.exports = model("group_courses", GroupCoursesSchema);
