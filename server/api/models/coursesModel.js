var { Schema, model } = require("mongoose");
var Lecturers = require("./lecturersModel");

var CoursesSchema = new Schema({
  course: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
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
  status: {
    type: Boolean,
    required: true,
    default: true,
  },
  level: {
    type: Number,
    required: true,
  },
  lecturer: {
    type: Schema.Types.ObjectId,
    ref: "lecturers",
  },
});

CoursesSchema.pre("save", function (next) {
  if (this.lecturer) {
    return Lecturers.findOne(this.lecturer, function (err, lecturer) {
      if (err) return next(err);
      if (!lecturer) return next(new Error("Invalid lecturer ID"));
      return next();
    });
  }
  return next();
});

module.exports = model("courses", CoursesSchema);
