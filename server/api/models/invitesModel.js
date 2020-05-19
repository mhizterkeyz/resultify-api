var { Schema, model } = require("mongoose");

var InvitesSchema = new Schema({
  role: {
    type: String,
    required: true,
  },
  created_at: {
    type: Date,
    required: true,
  },
});

InvitesSchema.methods = {
  toJson: function () {
    var invite = this.toObject();
    invite.invite_token = invite._id;
    delete invite._id;
    return invite;
  },
};

module.exports = model("invites", InvitesSchema);
