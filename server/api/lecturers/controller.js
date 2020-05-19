const Invites = require("../models/invitesModel");
const Users = require("../models/usersModel");
const Lecturer = require("../models/lecturersModel");
const Courses = require("../models/coursesModel");
const Student = require("../models/StudentsModel");
const CourseReg = require("../models/courseRegModel");
const Results = require("../models/resultsModel");
const GroupOptions = require("../models/groupOptionsModel");
const Utils = require("../../utils/util");
const SignToken = require("../../auth/auth").signToken;
const _ = require("lodash");

/**
 * Operation on self
 */
exports.createLecturer = function (req, res, next) {
  if (
    !req.validate({
      name: "required|string",
      username: "required|string",
      email: "required|string",
      invite_token: "required|string",
      password: "required|string",
      faculty: "required|string",
      department: "required|string",
      phone: "required",
      lga: "required|string",
      state_of_origin: "required|string",
      address: "required|string",
    })
  )
    return;
  const user = req.body;
  Invites.findById(req.body.invite_token, function (err, invite) {
    if (err)
      return res
        .status(400)
        .json({ message: "Invalid invite token!", data: {} });
    if (invite) {
      if (invite.role !== "lecturer")
        return res
          .status(400)
          .json({ message: "Invalid invite token!", data: {} });
      user.user_role = invite.role;
      user.group = req.group._id;
      return Users.create(user, function (err, created) {
        if (err) return next(err);
        req.result = _.merge(
          { personal_info: created.toJson() },
          {
            access_token: SignToken(created._id),
            group: {
              _id: user.group,
              faculty: user.faculty,
              department: user.department,
            },
          }
        );
        user.personal_info = created._id;
        Lecturer.create(user, function (err, created) {
          if (err) return next(err);
          const c = created.toObject();
          delete c.group;
          delete c.personal_info;
          req.result = _.merge(c, req.result);
          invite.remove();
          return res
            .status(200)
            .json({ message: "signup successful!", data: req.result });
        });
      });
    }
    return res
      .status(400)
      .json({ message: "Invalid invite token!", data: invite });
  });
};
exports.me = (attachToReq = false, msg = "") => (req, res, next) => {
  Lecturer.findOne({ personal_info: req.user._id })
    .populate("personal_info", "_id name email username")
    .populate("group", "_id faculty department")
    .then(function (lecturer) {
      if (attachToReq) {
        req.lecturer = lecturer;
        return next();
      }
      res.status(200).json({ message: msg, data: lecturer });
    })
    .catch(function (err) {
      next(err);
    });
};
exports.updateLecturer = (req, res, next) => {
  if (req.body.id) delete req.body.id;
  if (req.body.user_role) delete req.body.user_role;
  _.merge(req.user, req.body);
  req.user.save(function (err, data) {
    if (err) return next(err);
    next();
  });
};

/**
 * Operation Scoresheet
 */
const getScoreSheet = (courseId, year_submitted) => {
  return new Promise(async (resolve, reject) => {
    try {
      const regs = await CourseReg.find({
        course: courseId,
        year_registered: year_submitted,
      })
        .populate("course", "_id course semester level units")
        .populate(
          "student",
          "personal_data _id matric group entry_year student_set"
        )
        .exec();
      const scoresheet = regs.reduce(async (acc, reg) => {
        const user = await Users.findById(reg.student.personal_data);
        let result = await Results.findOne({
          course: reg.course._id,
          student: reg.student._id,
          year_submitted,
        });
        const res = {};
        res.name = user.name;
        res.matric = reg.student.matric;
        if (!result) {
          result = await Results.create({
            course: reg.course._id,
            student: reg.student._id,
            year_submitted,
          });
        }
        res.ca = result.ca;
        res.exam = result.exam;
        res.result_status = result.result_status;
        res._id = result._id;
        const groupDefaults = await GroupOptions.findOne({
          group: reg.student.group,
        });
        const gradeSystem = Utils.validateGradeSystem(
          groupDefaults.grade_system
        );
        const gradeData = Utils.getGradeData(
          parseInt(res.ca) + parseInt(res.exam),
          gradeSystem
        );
        res.grade = gradeData.grade;
        res.remark =
          gradeData.grade.toLowerCase() === "f" ? "Failed" : "Passed";
        return [...acc, res];
      }, []);
      resolve(scoresheet);
    } catch (err) {
      reject(err);
    }
  });
};
exports.getScoreSheet = (msg = "") => async (req, res, next) => {
  let data;
  if (
    req.query.course &&
    !_.find(req.assinged_courses, { _id: req.course._id })
  )
    return res
      .status(400)
      .json({ message: "This course wasn't assigned to you", data: {} });

  try {
    if (!req.query.course) {
      data = await new Promise(async (resolve, reject) => {
        try {
          const sheets = req.assinged_courses.reduce(async (acc, cur) => {
            let sheet = await getScoreSheet(
              cur._id,
              req.query.year_submitted || req.app_defaults.academic_year
            );
            return { ...acc, [cur.course]: sheet };
          }, {});
          resolve(sheets);
        } catch (err) {
          reject(err);
        }
      });
    } else {
      data = await getScoreSheet(
        req.course._id,
        req.query.year_submitted || req.app_defaults.academic_year
      );
    }
  } catch (err) {
    return next(err);
  }
  return res.status(200).json({ message: msg, data });
};
exports.updateScoreSheet = async (req, res, next) => {
  if (!req.validate({ ca: "number", exam: "number" })) return;
  try {
    const id = req.params.id;
    const result = await Results.findOne({ _id: id, result_status: 1 });
    if (!result)
      return res.status(400).json({
        message: "You can no longer make changes to this record.",
        data: {},
      });
    if (!_.find(req.assinged_courses, { _id: result.course }))
      return res.status(403).json({
        message: "This course wasn't assigned to you",
        data: {},
      });
    result.ca = req.body.ca !== undefined ? req.body.ca : result.ca;
    result.exam = req.body.exam !== undefined ? req.body.exam : result.exam;
    const newResult = await result.save();
    const student = await Student.findById(result.student);
    const user = await Users.findById(student.personal_data);
    const groupDefaults = await GroupOptions.findOne({
      group: student.group,
    });
    const gradeSystem = Utils.validateGradeSystem(groupDefaults.grade_system);
    const gradeData = Utils.getGradeData(
      parseInt(newResult.ca) + parseInt(newResult.exam),
      gradeSystem
    );
    const data = {
      name: user.name,
      matric: student.matric,
      ca: newResult.ca,
      exam: newResult.exam,
      result_status: newResult.result_status,
      _id: newResult._id,
      grade: gradeData.grade,
      remark: gradeData.grade.toLowerCase() === "f" ? "Failed" : "Passed",
    };
    return res.status(200).json({ message: "Record updated!", data });
  } catch (err) {
    return next(err);
  }
};
exports.saveScoreSheet = async (req, res, next) => {
  if (!req.validate({ course: "string", ignore_warning: "boolean" })) return;
  if (!req.course)
    return res.status(400).json({
      message: "Invalid input",
      data: { course: "course is required" },
    });
  const year_submitted =
    req.body.year_submitted ||
    req.query.year_submitted ||
    req.app_defaults.academic_year;
  const course = req.course._id;
  const ignore_warning = req.body.ignore_warning || req.query.ignore_warning;
  if (!_.find(req.assinged_courses, { _id: course }))
    return res.status(403).json({
      message: "This course wasn't assigned to you",
      data: {},
    });
  try {
    const results = await Results.find({
      course,
      year_submitted,
      result_status: 1,
    })
      .populate("student")
      .exec();
    if (results.length < 1)
      return res.status(404).json({
        message: "Could not find records",
        data: {},
      });
    const zero_results = results.reduce(function (acc, cur) {
      if (cur.exam + cur.ca < 1) {
        return [...acc, cur];
      }
      return acc;
    }, []);
    if (zero_results.length > 0 && !ignore_warning)
      return res.status(400).json({
        message:
          "The following results have a zero score. Set ignore_warning to true to ignore this warning.",
        data: zero_results,
      });
    const groups_to_alert = {};
    results.forEach((elem) => {
      elem.result_status = 2;
      groups_to_alert[elem.student.group] = elem.student.group;
      elem.save();
    });
    Object.keys(groups_to_alert).forEach(async (elem) => {
      await Utils.notify(
        elem,
        `${req.course.course}  results for ${year_submitted} has been submitted.`,
        req.body.message || req.query.message || ""
      );
    });
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Notifications Operation
 */
exports.notifications = async (req, res, next) => {
  try {
    if (req.params.id)
      return res
        .status(200)
        .json({ message: "", data: await Utils.notification(req.params.id) });
    return res
      .status(200)
      .json({ message: "", data: await Utils.notifications(req.user._id) });
  } catch (err) {
    return next(err);
  }
};

/**
 * Middlewares
 */
exports.getAssingedCourses = () => async (req, res, next) => {
  try {
    const data = await Courses.find({ lecturer: req.user._id });
    req.assinged_courses = data;
    return next();
  } catch (err) {
    return next(err);
  }
};
