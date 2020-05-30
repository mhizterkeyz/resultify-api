var Users = require("../models/usersModel");
var InstitutionalGroups = require("../models/institutionalGroupsModel");
var AppDefaults = require("../models/appOptionsModel");
const Students = require("../models/StudentsModel");
const Results = require("../models/resultsModel");
const GroupCourse = require("../models/groupCoursesModel");
const CourseReg = require("../models/courseRegModel");
const Utils = require("../../utils/util");
const GroupOptions = require("../models/groupOptionsModel");
var _ = require("lodash");
var Invites = require("../models/invitesModel");
var SignToken = require("../../auth/auth").signToken;
const CommonFunctions = require("../commonFunctions");

/**
 * App Options/Default
 */
exports.appDefaults = function (returnResults = false, msg = "") {
  return function (req, res, next) {
    AppDefaults.find()
      .then(function (defaults) {
        if (defaults.length > 0) {
          if (returnResults) {
            res.status(200).json({ message: msg, data: defaults[0] });
            return false;
          }
          req.app_defaults = defaults[0];
          next();
          return false;
        }
        return AppDefaults.create({
          semester: 1,
          academic_year: parseInt(new Date().getFullYear()),
        });
      })
      .then(function (defaults) {
        if (defaults) {
          if (returnResults)
            return res.status(200).json({ message: msg, data: defaults });
          req.app_defaults = defaults;
          return next();
        }
      })
      .catch(function (err) {
        return next(err);
      });
  };
};

/**
 * Inviting new administrators...
 */
CommonFunctions.inviteFunctions(exports, {
  first: { type: "administrator", msg: "An administrator's" },
  second: { type: "groupAdministrator", msg: "An exam officer's" },
});

/**
 * Operation on App's Administrator
 */

//Gets group/app administrator based on passed id
exports.adminRoute = function (req, res, next) {
  var id = req.params.id;
  Users.findById(id).then(
    function (user) {
      if (
        !user ||
        user.user_role === "student" ||
        user.user_role === "lecturer"
      )
        return res
          .status(404)
          .json({ message: "No admin with that ID", data: {} });
      req.req_user = user;
      next();
    },
    function (err) {
      next(err);
    }
  );
};
exports.getAppAdmins = function (req, res, next) {
  if (!req.user.root)
    return res
      .status(403)
      .json({ message: "You can't access this resource", data: {} });
  Users.find({ user_role: "administrator" }).then(
    function (admins) {
      var data = admins.map(function (elem) {
        return elem.toJson();
      });
      res.status(200).json({
        message: "",
        data: _.orderBy(data, { status: false }),
      });
    },
    function (err) {
      next(err);
    }
  );
};
const toggleUserState = async (user, val) => {
  user.status = val;
  try {
    return (await user.save()).toJson();
  } catch (e) {
    throw new Error(e);
  }
};
exports.deleteAppAdmin = async (req, res, next) => {
  if (!req.user.root)
    return res
      .status(403)
      .json({ message: "You can't access this resource", data: {} });
  if (req.req_user.root)
    return res
      .status(403)
      .json({ message: "You can't block the root administrator", data: {} });
  if (req.req_user.user_role !== "administrator")
    return res
      .status(404)
      .json({ message: "Could not find administrator", data: {} });
  try {
    return res.status(200).json({
      message: "Administrator blocked",
      data: await toggleUserState(req.req_user, false),
    });
  } catch (e) {
    return next(e);
  }
};
exports.createAppAdmin = function (req, res, next) {
  if (
    !req.validate({
      name: "required|string",
      username: "required|string",
      email: "required|string",
      invite_token: "required|string",
      password: "required|string",
      phone: "required",
      lga: "required|string",
      state_of_origin: "required|string",
      address: "required|string",
    })
  )
    return;
  var user = req.body;
  Invites.findById(req.body.invite_token, function (err, invite) {
    if (err)
      return res
        .status(400)
        .json({ message: "Invalid invite token!", data: {} });
    if (invite) {
      if (invite.role !== "administrator")
        return res
          .status(400)
          .json({ message: "Invalid invite token!", data: {} });
      user.user_role = invite.role;
      user.root && delete user.root;
      return Users.create(user, function (err, created) {
        if (err) return next(err);
        var access_token = SignToken(created._id);
        user = _.merge(created.toJson(), { access_token });
        invite.remove();
        return res.status(200).json({
          message: "Administrator created!",
          data: user,
        });
      });
    }
    return res.status(400).json({ message: "Invalid invite token!", data: {} });
  });
};
exports.updateAdminSelf = function (req, res, next) {
  CommonFunctions.userUpdateProtection(req);
  _.merge(req.user, req.body);
  req.user.save(function (err, saved) {
    if (err) return next(err);
    res.status(200).json({
      message: "Account updated",
      data: saved.toJson(),
    });
  });
};
exports.updateAdmin = async (req, res, next) => {
  if (!req.user.root)
    return res
      .status(403)
      .json({ message: "You can't access this resource", data: {} });
  if (req.req_user.user_role !== "administrator")
    return res
      .status(404)
      .json({ message: "Could not find administrator", data: {} });
  try {
    return res.status(200).json({
      message: "Administrator unblocked",
      data: await toggleUserState(req.req_user, true),
    });
  } catch (e) {
    return next(e);
  }
};

/**
 * Result operations
 */
const getSingleResult = (courses, student, year) =>
  new Promise(async (resolve, reject) => {
    try {
      const did_reg = await CourseReg.find({
        student: student._id,
        year_registered: year,
        reg_status: true,
      });
      if (did_reg.length < 1) {
        return resolve({
          results: "Didn't register any courses this semester",
          tcr: 0,
          tce: 0,
          tgp: 0,
        });
      }
      const response = await courses.reduce(
        async (acc, cur) => {
          let did_reg = await CourseReg.findOne({
            student: student._id,
            course: cur.course._id,
            year_registered: year,
            reg_status: true,
          });
          if (!did_reg) {
            acc.data.push({
              course: cur.course.course,
              units: cur.course.units,
              score: 0,
              exam: 0,
              first_ca: 0,
              second_ca: 0,
              third_ca: 0,
              grade: null,
              remark: "DRP",
              points: 0,
            });
            return acc;
          } else {
            acc.tcr += cur.course.units;
            const result = await Results.findOne({
              student: student._id,
              course: cur.course._id,
              year_submitted: year,
              $or: [{ result_status: 3 }, { result_status: 4 }],
            });
            if (!result) {
              acc.data.push({
                course: cur.course.course,
                units: cur.course.units,
                score: 0,
                exam: 0,
                first_ca: 0,
                second_ca: 0,
                third_ca: 0,
                grade: null,
                remark: "Pending...",
                points: 0,
              });
              return acc;
            } else {
              const { exam, ca_1, ca_2, ca_3 } = result;
              const group_defaults = await GroupOptions.findOne({
                group: student.group,
                set: student.student_set,
              });
              const grade_data = Utils.getGradeData(
                exam + ca_1 + ca_2 + ca_3,
                Utils.validateGradeSystem(group_defaults.grade_system)
              );
              acc.data.push({
                course: cur.course.course,
                units: cur.course.units,
                score: exam + ca_1 + ca_2 + ca_3,
                exam,
                first_ca: ca_1,
                second_ca: ca_2,
                third_ca: ca_3,
                grade: grade_data.grade,
                remark:
                  grade_data.grade.toLowerCase() === "f" ? "Failed" : "Passed",
                points: grade_data.points,
              });
              acc.tce +=
                grade_data.grade.toLowerCase() === "f" ? 0 : cur.course.units;
              acc.tgp += grade_data.points * cur.course.units;
              return acc;
            }
          }
        },
        { data: [], tcr: 0, tce: 0, tgp: 0 }
      );
      return resolve(response);
    } catch (err) {
      return reject(err);
    }
  });
const getSingleResultCos = (courses, student, year, semester) =>
  new Promise(async (resolve, reject) => {
    try {
      const response = await (
        await CourseReg.find({
          student: student._id,
          year_registered: year,
          reg_status: true,
        })
          .populate("course")
          .exec()
      )
        .reduce((acc, cur) => {
          if (cur.course.semester === semester) return [...acc, cur];
          return acc;
        }, [])
        .reduce(
          async (acc, cur) => {
            const did_reg = courses.reduce((accu, curr) => {
              if (curr.course._id.toString() === cur.course._id.toString())
                return true;
              return accu;
            }, false);
            if (did_reg) return acc;
            acc.tcr += cur.course.units;
            if (typeof acc.data !== typeof []) acc.data = [];
            const result = await Results.findOne({
              student: student._id,
              course: cur.course._id,
              year_submitted: year,
              $or: [{ result_status: 3 }, { result_status: 4 }],
            });
            if (!result) {
              acc.data.push({
                course: cur.course.course,
                units: cur.course.units,
                score: 0,
                exam: 0,
                first_ca: 0,
                second_ca: 0,
                third_ca: 0,
                grade: null,
                remark: "Pending...",
                points: 0,
              });
              return acc;
            } else {
              const { exam, ca_1, ca_2, ca_3 } = result;
              const total = exam + ca_1 + ca_2 + ca_3;
              const group_defaults = await GroupOptions.findOne({
                group: student.group,
                set: student.student_set,
              });
              const grade_data = Utils.getGradeData(
                total,
                Utils.validateGradeSystem(group_defaults.grade_system)
              );
              acc.data.push({
                course: cur.course.course,
                units: cur.course.units,
                score: total,
                exam,
                first_ca: ca_1,
                second_ca: ca_2,
                third_ca: ca_3,
                grade: grade_data.grade,
                remark:
                  grade_data.grade.toLowerCase() === "f" ? "Failed" : "Passed",
                points: grade_data.points,
              });
              acc.tce +=
                grade_data.grade.toLowerCase() === "f" ? 0 : cur.course.units;
              acc.tgp += grade_data.points * cur.course.units;
              return acc;
            }
          },
          {
            data: "Didn't register any carryovers this semester.",
            tcr: 0,
            tce: 0,
            tgp: 0,
          }
        );
      return resolve(response);
    } catch (err) {
      return reject(err);
    }
  });
const getPreviousData = (courses, student, year, semester) =>
  new Promise(async (resolve, reject) => {
    try {
      const response = courses.reduce(
        async (acc, cur) => {
          const did_reg = (
            await CourseReg.find({
              student: student._id,
              course: cur.course._id,
              reg_status: true,
            })
              .populate("course")
              .exec()
          ).reduce((acc, cur) => {
            if (cur.year_registered === year && cur.course.semester > semester)
              return acc;
            if (cur.year_registered <= year) return [...acc, cur];
            return acc;
          }, []);
          if (did_reg.length < 1) {
            acc.remarks.push(cur.course.course);
            return acc;
          }
          acc.ctcr += cur.course.units;
          const result = (
            await Results.find({
              student: student._id,
              course: cur.course._id,
              $or: [{ result_status: 3 }, { result_status: 4 }],
            })
              .populate("course")
              .exec()
          ).reduce((acc, cur) => {
            if (cur.year_submitted === year && cur.course.semester > semester)
              return acc;
            if (cur.year_submitted <= year) return [...acc, cur];
            return acc;
          }, []);
          if (result.length < 1) {
            return acc;
          }
          const slap = await result.reduce(
            async (acc, cur) => {
              const group_defaults = await GroupOptions.findOne({
                group: student.group,
                set: student.student_set,
              });
              const { exam, ca_1, ca_2, ca_3 } = cur;
              const grade_data = Utils.getGradeData(
                exam + ca_1 + ca_2 + ca_3,
                Utils.validateGradeSystem(group_defaults.grade_system)
              );
              if (grade_data.grade.toLowerCase() !== "f") {
                acc.found = true;
                acc.ctce = cur.course.units;
                acc.ctgp = grade_data.points * cur.course.units;
              }
              return acc;
            },
            { found: false, ctce: 0, ctgp: 0 }
          );
          if (!slap.found) {
            acc.remarks.push(cur.course.course);
            return acc;
          }
          acc.ctce += slap.ctce;
          acc.ctgp += slap.ctgp;
          return acc;
        },
        { ctcr: 0, ctce: 0, ctgp: 0, remarks: [] }
      );
      return resolve(response);
    } catch (err) {
      return reject(err);
    }
  });
const getPreviousResult = (student, req) =>
  new Promise(async (resolve, reject) => {
    try {
      const core = (
        await GroupCourse.find({
          group: req.group._id,
          student_set: req.body.student_set,
          course_type: true,
        })
          .populate("course")
          .exec()
      ).reduce((acc, cur) => {
        if (
          cur.course.level ===
            (req.app_defaults.academic_year - req.body.year_submitted + 1) *
              100 &&
          cur.course.semester > req.body.semester
        )
          return acc;
        if (
          cur.course.level <=
          (req.app_defaults.academic_year - req.body.year_submitted + 1) * 100
        )
          return [...acc, cur];
        return acc;
      }, []);
      const electives = (
        await GroupCourse.find({
          group: req.group._id,
          student_set: req.body.student_set,
          course_type: false,
        })
          .populate("course")
          .exec()
      ).reduce((acc, cur) => {
        if (
          cur.course.level ===
            (req.app_defaults.academic_year - req.body.year_submitted + 1) *
              100 &&
          cur.course.semester > req.body.semester
        )
          return acc;
        if (
          cur.course.level <=
          (req.app_defaults.academic_year - req.body.year_submitted + 1) * 100
        )
          return [...acc, cur];
        return acc;
      }, []);
      const prev_core = await getPreviousData(
        core,
        student,
        req.body.year_submitted,
        req.body.semester
      );
      const prev_elec = await getPreviousData(
        electives,
        student,
        req.body.year_submitted,
        req.body.semester
      );
      return resolve({
        tce: prev_core.ctce + prev_elec.ctce,
        tcr: prev_core.ctcr + prev_elec.ctcr,
        tgp: prev_core.ctgp + prev_elec.ctgp,
        remarks: prev_core.remarks,
      });
    } catch (err) {
      return reject(err);
    }
  });
exports.get_results = (msg = "") => async (req, res, next) => {
  if (
    !req.validate({
      faculty: "string|required",
      department: "string|required",
      student_set: "number|required",
      year_submitted: "number|required",
      semester: "number|required",
    })
  )
    return;
  try {
    const students = await Students.find({
      group: req.group._id,
      student_set: req.body.student_set,
      entry_year: { $lte: req.body.year_submitted },
    })
      .populate("personal_data")
      .exec();
    const core = (
      await GroupCourse.find({
        group: req.group._id,
        student_set: req.body.student_set,
        course_type: true,
      })
        .populate("course")
        .exec()
    ).reduce((acc, cur) => {
      if (
        cur.course.semester === req.body.semester &&
        cur.course.level ===
          (req.app_defaults.academic_year - req.body.year_submitted + 1) * 100
      )
        return [...acc, cur];
      return acc;
    }, []);
    const electives = (
      await GroupCourse.find({
        group: req.group._id,
        student_set: req.body.student_set,
        course_type: false,
      })
        .populate("course")
        .exec()
    ).reduce((acc, cur) => {
      if (
        cur.course.semester === req.body.semester &&
        cur.course.level ===
          (req.app_defaults.academic_year - req.body.year_submitted + 1) * 100
      )
        return [...acc, cur];
      return acc;
    }, []);
    const results = await students.reduce(async (acc, cur) => {
      const result_single_core = await getSingleResult(
        core,
        cur,
        req.body.year_submitted
      );
      const result_single_elective = await getSingleResult(
        electives,
        cur,
        req.body.year_submitted
      );
      const result_single_carryover = await getSingleResultCos(
        core,
        cur,
        req.body.year_submitted,
        req.body.semester
      );
      const previous = await getPreviousResult(cur, req);
      const tce =
        result_single_core.tce +
        result_single_elective.tce +
        result_single_carryover.tce;
      const tcr =
        result_single_core.tcr +
        result_single_elective.tcr +
        result_single_carryover.tcr;
      const tgp =
        result_single_core.tgp +
        result_single_elective.tgp +
        result_single_carryover.tgp;
      const cgpa = parseFloat((previous.tgp / (previous.tce || 1)).toFixed(2));
      previous.tce -= tce;
      previous.tcr -= tcr;
      previous.tgp -= tgp;
      previous.gpa = parseFloat(
        (previous.tgp / (previous.tce || 1)).toFixed(2)
      );
      const remarks = previous.remarks;
      delete previous.remarks;
      return [
        ...acc,
        {
          matric: cur.matric,
          name: cur.personal_data.name,
          core: result_single_core.data,
          electives: result_single_elective.data,
          carryovers: result_single_carryover.data,
          tce,
          tcr,
          tgp,
          gpa: parseFloat((tgp / (tcr || 1)).toFixed(2)),
          previous,
          cgpa,
          remarks,
        },
      ];
    }, []);
    res.status(200).json({
      message: msg,
      data: { core, electives, results },
    });
  } catch (err) {
    return next(err);
  }
};
exports.reject_result = async (req, res, next) => {
  if (
    !req.validate({
      year_submitted: "number|required",
      faculty: "required|string",
      department: "required|string",
      student_set: "required|number",
      semester: "required|number",
    })
  )
    return;
  try {
    const students = await Students.find({
      group: req.group._id,
      student_set: req.body.student_set,
      entry_year: { $lte: req.body.year_submitted },
    });
    const final_play = await students.reduce(
      async (acc, cur) => {
        const student = cur._id;
        const results = await (
          await CourseReg.find({
            student,
            year_registered: req.body.year_submitted,
          })
            .populate("course")
            .exec()
        )
          .reduce((acc, cur) => {
            if (cur.course.semester === req.body.semester) return [...acc, cur];
            return acc;
          }, [])
          .reduce(
            async (acc, cur) => {
              const result = await Results.findOne({
                course: cur.course._id,
                year_submitted: req.body.year_submitted,
                $or: [{ result_status: 3 }, { result_status: 4 }],
                student,
              });
              if (!result) acc.status = false;
              acc.results.push(result);
              return acc;
            },
            { results: [], status: true }
          );
        if (!results.status) acc.status = false;
        acc.results = [...acc.results, ...results.results];
        return acc;
      },
      { results: [], status: true }
    );
    if (!final_play.status)
      return res
        .status(403)
        .json({ message: "You can't reject pending results.", data: {} });
    await Promise.all(
      final_play.results.map(async (elem) => {
        elem.result_status = 2;
        return await elem.save();
      })
    );
    await Utils.notify(
      req.group._id,
      `The ${req.body.semester} semester results for ${req.body.department} in the faculty of ${req.body.faculty} year of ${req.body.year_submitted} has been rejected for ${req.body.student_set} set`,
      req.body.message || ""
    );
    return next();
  } catch (err) {
    return next(err);
  }
};
exports.save_result = async (req, res, next) => {
  if (
    !req.validate({
      year_submitted: "number|required",
      faculty: "required|string",
      department: "required|string",
      student_set: "required|number",
      semester: "required|number",
    })
  )
    return;
  try {
    const students = await Students.find({
      group: req.group._id,
      student_set: req.body.student_set,
      entry_year: { $lte: req.body.year_submitted },
    });
    const final_play = await students.reduce(
      async (acc, cur) => {
        const student = cur._id;
        const results = await (
          await CourseReg.find({
            student,
            year_registered: req.body.year_submitted,
          })
            .populate("course")
            .exec()
        )
          .reduce((acc, cur) => {
            if (cur.course.semester === req.body.semester) return [...acc, cur];
            return acc;
          }, [])
          .reduce(
            async (acc, cur) => {
              const result = await Results.findOne({
                course: cur.course._id,
                year_submitted: req.body.year_submitted,
                $or: [{ result_status: 3 }, { result_status: 4 }],
                student,
              });
              if (!result) acc.status = false;
              acc.results.push(result);
              return acc;
            },
            { results: [], status: true }
          );
        if (!results.status) acc.status = false;
        acc.results = [...acc.results, ...results.results];
        return acc;
      },
      { results: [], status: true }
    );
    if (!final_play.status)
      return res
        .status(403)
        .json({ message: "You can't approve with pending results.", data: {} });
    await Promise.all(
      final_play.results.map(async (elem) => {
        elem.result_status = 4;
        return await elem.save();
      })
    );
    await Promise.all(
      students.map(async (elem) => {
        return await Utils.notify(
          elem.personal_data,
          `The results for ${req.body.department} in the faculty of ${req.body.faculty} has been approved.`,
          req.body.message || ""
        );
      })
    );
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Operations on Institutional Groups
 */
exports.groupRoute = function (req, res, next) {
  var id = req.params.id;
  InstitutionalGroups.findById(id)
    .populate("group_admin", "_id name email status")
    .exec()
    .then(
      function (group) {
        if (!group)
          return res
            .status(404)
            .json({ message: "No group with that ID", data: {} });
        req.group = group;
        next();
      },
      function (err) {
        next(err);
      }
    );
};
exports.getGroupAdmins = function (req, res, next) {
  Users.find({ user_role: "groupAdministrator" }).then(
    function (admins) {
      var result = admins.map(function (admin) {
        return admin.toJson();
      });
      res.status(200).json({
        message: "",
        data: _.orderBy(result, { status: false }),
      });
    },
    function (err) {
      next(err);
    }
  );
};
exports.getOneAdmin = async (req, res, next) => {
  const admin = req.req_user.toJson();
  if ((req.req_user.user_role = "groupAdministrator")) {
    const groups = await InstitutionalGroups.find({
      group_admin: req.req_user._id,
    });
    admin.alloted = groups;
  }
  return res.status(200).json({
    message: "",
    data: admin,
  });
};
exports.getGroups = function (req, res, next) {
  InstitutionalGroups.find({})
    .populate("group_admin", "_id name email status")
    .exec()
    .then(
      function (group) {
        res.status(200).json({
          message: "",
          data: _.orderBy(group, { status: false }),
        });
      },
      function (err) {
        next(err);
      }
    );
};
exports.getOneGroup = function (req, res, next) {
  var group = req.group;
  return res.status(200).json({
    message: "",
    data: group,
  });
};
exports.deleteAdmin = async (req, res, next) => {
  try {
    return res.status(200).json({
      message: "Exam officer blocked",
      data: await toggleUserState(req.req_user, false),
    });
  } catch (e) {
    return next(e);
  }
};
exports.unblockAdmin = async (req, res, next) => {
  try {
    return res.status(200).json({
      message: "Exam officer unblocked",
      data: await toggleUserState(req.req_user, true),
    });
  } catch (e) {
    return next(e);
  }
};

exports.addGroup = function (req, res, next) {
  var newGroup = _.merge(req.body, {
    faculty: req.body.faculty.toLowerCase(),
    department: req.body.department.toLowerCase(),
  });
  if (
    !req.validate({
      faculty: "required|string",
      department: "required|string",
      group_admin: "string",
    })
  )
    return;
  InstitutionalGroups.findOne({
    faculty: req.body.faculty.toLowerCase(),
    department: req.body.department.toLowerCase(),
  })
    .then(function (group) {
      if (group) {
        res.status(400).json({
          message: "A group already exists with the same credentials!",
          data: {},
        });
        return false;
      }
      return true;
    })
    .then(function (goAhead) {
      if (goAhead) return InstitutionalGroups.create(newGroup);
    })
    .then(function (group) {
      res.status(200).json({
        message: "Group created",
        data: group,
      });
    })
    .catch(function (err) {
      next(err);
    });
};
exports.updateGroup = function (req, res, next) {
  var group = req.group;
  var update = req.body;
  if (update.faculty) update.faculty = update.faculty.toLowerCase();
  if (update.department) update.department = update.department.toLowerCase();
  var newGroup = _.merge(group.toObject(), update);
  InstitutionalGroups.findOne({
    faculty: newGroup.faculty,
    department: newGroup.department,
  })
    .then(function (exitingGroup) {
      if (
        exitingGroup &&
        exitingGroup.toObject()._id.toString() !== newGroup._id.toString()
      )
        return res.status(400).json({
          message: "A group already exists with the same credentials!",
          data: {},
        });
      if (update.id) delete update.id;
      _.merge(group, update);
      group.save(function (err, save) {
        if (err) return next(err);
        return res.status(200).json({
          message: "Group updated!",
          data: save,
        });
      });
    })
    .catch(function (err) {
      next(err);
    });
};
