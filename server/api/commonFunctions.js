const Invites = require("./models/invitesModel");
const _ = require("lodash");

exports.inviteFunctions = (exports, options) => {
  exports.newInvite = async (req, res, next) => {
    if (
      !req.validate({
        type: "required|boolean",
        email: "required|string",
      })
    )
      return;
    const inviteType = req.body.type ? options.first.type : options.second.type;
    const invitation_type = req.body.type
      ? options.first.msg
      : options.second.msg;
    try {
      /*
      +++++++++++++++++++++++++++++++++++
      | TODO: Do some email sending and  |
      |       only after a confimation   |
      |       should you create an invite|
      ++++++++++++++++++++++++++++++++++++
    */
      const checkInvites = await Invites.findOne({
        email: req.body.email,
        status: 0,
      });
      if (checkInvites)
        return res.status(400).json({
          message: "An invite has already been sent to that email",
          data: {},
        });
      const invitation = await Invites.create({
        role: inviteType,
        email: req.body.email,
        created_at: Date.now().toString(),
      });
      return res.status(200).json({
        message: `${invitation_type} invitation has been sent to ${req.body.email}`,
        data: invitation.toJson(),
      });
    } catch (e) {
      return next(e);
    }
  };
  exports.getInvites = async (req, res, next) => {
    roles = Object.values(options).reduce((acc, cur) => {
      return [...acc, { role: cur.type }];
    }, []);
    try {
      const invites = await Invites.find({ $or: roles });
      return res.status(200).json({
        message: "",
        data: _.orderBy(
          invites.map((elem) => elem.toJson()),
          { status: false }
        ),
      });
    } catch (e) {
      return next(e);
    }
  };
  exports.deleteInvite = async (req, res, next) => {
    const invite_id = req.params.invite_id;
    try {
      const invite = await Invites.findById(invite_id);
      if (!invite)
        return res
          .status(404)
          .json({ message: "Could not find invite", data: {} });
      invite.status = 2;
      const deleted = await invite.save();
      return res
        .status(200)
        .json({ message: "Invite blocked", data: deleted.toJson() });
    } catch (e) {
      next(e);
    }
  };
  exports.getOneInvite = async (req, res, next) => {
    const invite_id = req.params.invite_id;
    try {
      const invite = await Invites.findById(invite_id);
      if (!invite)
        return res
          .status(404)
          .json({ message: "Could not find invite", data: {} });
      return res.status(200).json({ message: "", data: invite.toJson() });
    } catch (e) {
      return next(e);
    }
  };
};
exports.userUpdateProtection = (req) => {
  req.body.id && delete req.body.id;
  req.body.user_role && delete req.body.user_role;
  req.body.root && delete req.body.root;
  req.body.status && delete req.body.status;
};
