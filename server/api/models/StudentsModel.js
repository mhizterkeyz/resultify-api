var { Schema, model } = require("mongoose");

var StudentsSchema = new Schema({
  personal_data: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Users",
    unique: true,
  },
  matric: {
    type: String,
    unique: true,
    required: true,
  },
  entry_year: {
    type: Number,
    required: true,
  },
  student_set: {
    type: Number,
    required: true,
  },
  group: {
    type: Schema.Types.ObjectId,
    ref: "institutional_groups",
    required: true,
  },
});

module.exports = model("students", StudentsSchema);
