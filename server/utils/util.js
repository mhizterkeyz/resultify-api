const Notification = require("../api/models/notificationModel");
exports.validateGradeSystem = function (gs = "") {
  gs = gs.split(",");
  var invalid = false;
  var result = {};
  gs.map(function (elem) {
    elem = elem.split("|");
    if (elem.length !== 4) {
      invalid = true;
      return false;
    }
    if (
      typeof elem[0] !== "string" ||
      isNaN(parseInt(elem[1])) ||
      isNaN(parseInt(elem[2])) ||
      isNaN(elem[3])
    ) {
      invalid = true;
      return false;
    }
    result[elem[0].toString().toLowerCase()] = {
      grade: elem[0],
      points: parseInt(elem[1]),
      min: parseInt(elem[2]),
      max: parseInt(elem[3]),
    };
    return result[elem[0].toString().toLowerCase()];
  });
  if (invalid) return false;
  return result;
};
exports.getGradeData = (score, gradeSystem) => {
  if (score < 0) score = 0;
  let res;
  Object.values(gradeSystem).forEach((g) => {
    if (score <= g.max && score >= g.min) res = g;
  });
  return res;
};
exports.notify = async (id, notification, msg = "") => {
  try {
    const not = await Notification.create({
      user_id: id,
      notification,
      message: msg,
    });
    return not;
  } catch (err) {
    return err;
  }
};
exports.notifications = (user_id) =>
  new Promise(async (resolve, reject) => {
    try {
      const nots = await Notification.find({ user_id });
      const res = await Promise.all(
        nots.map(async (not) => {
          not.notification_status =
            not.notification_status === 1 ? 2 : not.notification_status;
          const se = await not.save();
          return se;
        })
      );
      return resolve(res);
    } catch (err) {
      return reject(err);
    }
  });
exports.notification = (id) =>
  new Promise(async (resolve, reject) => {
    try {
      const not = await Notification.findById(id);
      not.notification_status = 3;
      resolve(await not.save());
    } catch (err) {
      reject(err);
    }
  });
