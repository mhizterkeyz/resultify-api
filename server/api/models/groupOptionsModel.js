var { Schema, model } = require("mongoose");

var GroupOptionsSchema = new Schema({
  grade_system: {
    type: String,
    required: true,
    default: "A|5|70|100,B|4|60|69,C|3|50|59,D|2|45|49,F|0|0|44",
  },
  set: {
    type: Number,
    required: true,
  },
  levels: {
    type: Number,
    default: 4,
  },
  reg_cap: {
    type: Number,
    default: 27,
  },
  reg_norm: {
    type: Number,
    default: 24,
  },
  reg_min: {
    type: Number,
    default: 16,
  },
  group: {
    type: Schema.Types.ObjectId,
    ref: "institutional_groups",
    required: true,
  },
});

module.exports = model("group_options", GroupOptionsSchema);
