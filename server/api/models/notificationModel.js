var { Schema, model } = require("mongoose");

var NotificationsSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  notification: {
    type: String,
    required: true,
  },
  message: String,
  notification_status: {
    type: Number,
    required: true,
    default: 1,
  },
});

module.exports = model("Notifications", NotificationsSchema);
