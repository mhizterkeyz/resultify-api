var { Schema, model } = require("mongoose");

var InvitesSchema = new Schema({
  role: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  created_at: {
    type: Date,
    required: true,
  },
  status: {
    type: Number,
    required: true,
    default: 0,
  },
});

InvitesSchema.methods = {
  toJson: function () {
    var invite = this.toObject();
    invite.invite_token = invite._id;
    delete invite._id;
    invite.status =
      invite.status === 0 ? "Active" : invite.status === 1 ? "Used" : "Blocked";
    return invite;
  },
};

module.exports = model("invites", InvitesSchema);
