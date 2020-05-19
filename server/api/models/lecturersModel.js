var { Schema, model } = require("mongoose");

var LecturersSchema = new Schema({
  personal_info: {
    type: Schema.Types.ObjectId,
    ref: "Users",
    required: true,
    unique: true,
  },
  group: {
    type: Schema.Types.ObjectId,
    ref: "institutional_groups",
    required: true,
  },
});

module.exports = model("lecturers", LecturersSchema);
