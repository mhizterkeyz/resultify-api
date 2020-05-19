var { Schema, model } = require("mongoose");
var Users = require("./usersModel");

var InstitutionalGroupsSchema = new Schema({
  faculty: {
    type: String,
    required: true,
  },
  department: {
    type: String,
    required: true,
  },
  group_admin: {
    type: Schema.Types.ObjectId,
    ref: "Users",
  },
});

InstitutionalGroupsSchema.pre("save", function (next) {
  if (this.group_admin) {
    return Users.findById(this.group_admin, function (err, user) {
      if (err) return next(err);
      if (user) {
        if (user.user_role !== "groupAdministrator")
          return next(new Error("Invalid Administrotor Id"));
        return next();
      }
      return next(new Error("Invalid Administrator Id"));
    });
  } else {
    this.group_admin = null;
  }
  return next();
});

module.exports = model("institutional_groups", InstitutionalGroupsSchema);
