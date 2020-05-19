var { Schema, model } = require("mongoose");
var Lecturers = require("./lecturersModel");

var CoursesSchema = new Schema({
  course: {
    type: String,
    required: true,
    unique: true,
  },
  units: {
    type: Number,
    required: true,
  },
  added_by: {
    type: Schema.Types.ObjectId,
    ref: "institutional_groups",
    required: true,
  },
  semester: {
    type: Number,
    required: true,
  },
  level: {
    type: Number,
    required: true,
  },
  lecturer: {
    type: Schema.Types.ObjectId,
    ref: "Users",
  },
});

CoursesSchema.pre("save", function (next) {
  if (this.lecturer) {
    Lecturers.find({ personal_info: this.lecturer }, function (err, lecturer) {
      if (err) return next(err);
      this.lecturer = lecturer._id;
      next();
    });
  }
  next();
});

module.exports = model("courses", CoursesSchema);
