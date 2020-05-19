var { Schema, model } = require("mongoose");
var bcrypt = require("bcrypt");

var UsersSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  username: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  user_role: {
    type: String,
    required: true,
  },
  phone: {
    type: Number,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  lga: {
    type: String,
    required: true,
  },
  state_of_origin: {
    type: String,
    required: true,
  },
});

UsersSchema.pre("save", function (next) {
  if (!this.isModified("password")) return next();
  this.password = this.encryptPassword(this.password);
  next();
});

UsersSchema.methods = {
  authenticate: function (plainTextPassword) {
    return bcrypt.compareSync(plainTextPassword, this.password);
  },
  encryptPassword: function (plainTextPassword) {
    if (!plainTextPassword) return "";
    var salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(plainTextPassword, salt);
  },
  toJson: function () {
    var pikin = this.toObject();
    delete pikin.password;
    return pikin;
  },
};

module.exports = model("Users", UsersSchema);
