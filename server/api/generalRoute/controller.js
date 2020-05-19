const Invites = require("../models/invitesModel");
const Users = require("../models/usersModel");
const Groups = require("../models/institutionalGroupsModel");

exports.verify_inivite = () => async (req, res) => {
  try {
    const invite = await Invites.findById(req.params.id);
    if (invite) return res.status(200).json({ message: "", data: invite });
    return res.status(400).json({ message: "invalid invite token", data: {} });
  } catch (err) {
    return res.status(400).json({ message: "invalid invite token", data: {} });
  }
};
exports.get_groups = () => async (req, res, next) => {
  try {
    const groups = (await Groups.find()).reduce((acc, cur) => {
      if (acc[cur.faculty])
        return { ...acc, [cur.faculty]: [...acc[cur.faculty], cur.department] };
      return { ...acc, [cur.faculty]: [cur.department] };
    }, {});
    res.status(200).json({ message: "", data: groups });
  } catch (err) {
    return next(err);
  }
};
exports.verify_cred = () => async (req, res, next) => {
  try {
    const user = await Users.findOne({
      $or: [{ email: req.params.id }, { username: req.params.id }],
    });
    if (user) return res.status(200).json({ message: "", data: req.params.id });
    return res.status(404).json({ message: "", data: {} });
  } catch (err) {
    return next(err);
  }
};
