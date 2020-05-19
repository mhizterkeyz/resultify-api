var Student = require("../models/StudentsModel");
var Invites = require("../models/invitesModel");
var Users = require("../models/usersModel");
var Course = require("../models/groupCoursesModel");
var GroupOptions = require("../models/groupOptionsModel");
var CourseReg = require("../models/courseRegModel");
var GroupCourse = require("../models/groupCoursesModel");
var Utils = require("../../utils/util");
var Results = require("../models/resultsModel");
var SignToken = require("../../auth/auth").signToken;
var _ = require("lodash");

/**
 * Operation on self
 */
exports.createStudent = function (req, res, next) {
  if (
    !req.validate({
      name: "required|string",
      username: "required|string",
      email: "required|string",
      invite_token: "required|string",
      password: "required|string",
      matric: "required|string",
      entry_year: "required|number",
      student_set: "required|number",
      faculty: "required|string",
      department: "required|string",
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
      if (invite.role !== "student")
        return res
          .status(400)
          .json({ message: "Invalid invite token!", data: {} });
      user.user_role = invite.role;
      user.group = req.group._id;
      return Student.findOne({ matric: user.matric })
        .then(function (student) {
          if (student) {
            res
              .status(400)
              .json({ message: "Account already exists!", data: {} });
            return false;
          }
          return true;
        })
        .then(function (truth) {
          if (truth)
            Users.create(user, function (err, created) {
              if (err) return next(err);
              req.result = _.merge(
                { personal_data: created.toJson() },
                {
                  access_token: SignToken(created._id),
                  group: {
                    _id: user.group,
                    faculty: user.faculty,
                    department: user.department,
                  },
                }
              );
              user.personal_data = created._id;
              Student.create(user, function (err, created) {
                if (err) return next(err);
                var c = created.toObject();
                delete c.group;
                delete c.personal_data;
                req.result = _.merge(c, req.result);
                invite.remove();
                return res
                  .status(200)
                  .json({ message: "signup successful!", data: req.result });
              });
            });
        })
        .catch(function (err) {
          next(err);
        });
    }
    return res.status(400).json({ message: "Invalid invite token!", data: {} });
  });
};
exports.me = function (nexted = false, attachToReq = false) {
  return function (req, res, next) {
    Student.findOne({ personal_data: req.user._id })
      .populate("personal_data", "_id name email username")
      .populate("group", "_id faculty department")
      .then(function (student) {
        if (attachToReq) {
          req.student = student;
          return next();
        }
        res
          .status(200)
          .json({ message: nexted ? "Account updated!" : "", data: student });
      })
      .catch(function (err) {
        next(err);
      });
  };
};
exports.updateStudent = function (req, res, next) {
  if (req.body.id) delete req.body.id;
  if (req.body.user_role) delete req.body.user_role;
  _.merge(req.user, req.body);
  req.user.save(function (err, saved) {
    if (err) return next(err);
    return next();
  });
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
              ca: 0,
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
              result_status: 4,
            });
            if (!result) {
              acc.data.push({
                course: cur.course.course,
                units: cur.course.units,
                score: 0,
                exam: 0,
                ca: 0,
                grade: null,
                remark: "Pending...",
                points: 0,
              });
              return acc;
            } else {
              const { exam, ca } = result;
              const group_defaults = await GroupOptions.findOne({
                group: student.group._id,
                set: student.student_set,
              });
              const grade_data = Utils.getGradeData(
                exam + ca,
                Utils.validateGradeSystem(group_defaults.grade_system)
              );
              acc.data.push({
                course: cur.course.course,
                units: cur.course.units,
                score: exam + ca,
                exam,
                ca,
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
              result_status: 4,
            });
            if (!result) {
              acc.data.push({
                course: cur.course.course,
                units: cur.course.units,
                score: 0,
                exam: 0,
                ca: 0,
                grade: null,
                remark: "Pending...",
                points: 0,
              });
              return acc;
            } else {
              const { exam, ca } = result;
              const group_defaults = await GroupOptions.findOne({
                group: student.group._id,
                set: student.student_set,
              });
              const grade_data = Utils.getGradeData(
                exam + ca,
                Utils.validateGradeSystem(group_defaults.grade_system)
              );
              acc.data.push({
                course: cur.course.course,
                units: cur.course.units,
                score: exam + ca,
                exam,
                ca,
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
              result_status: 4,
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
                group: student.group._id,
                set: student.student_set,
              });
              const { exam, ca } = cur;
              const grade_data = Utils.getGradeData(
                exam + ca,
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
          group: req.student.group._id,
          student_set: req.student.student_set,
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
          group: req.student.group._id,
          student_set: req.student.student_set,
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
      year_submitted: "number|required",
      semester: "number|required",
    })
  )
    return;
  try {
    const core = (
      await GroupCourse.find({
        group: req.student.group._id,
        student_set: req.student.student_set,
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
        group: req.student.group._id,
        student_set: req.student.student_set,
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
    const result_single_core = await getSingleResult(
      core,
      req.student,
      req.body.year_submitted
    );
    const result_single_elective = await getSingleResult(
      electives,
      req.student,
      req.body.year_submitted
    );
    const result_single_carryover = await getSingleResultCos(
      core,
      req.student,
      req.body.year_submitted,
      req.body.semester
    );
    const previous = await getPreviousResult(req.student, req);
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
    previous.gpa = parseFloat((previous.tgp / (previous.tce || 1)).toFixed(2));
    const remarks = previous.remarks;
    delete previous.remarks;

    const results = {
      matric: req.student.matric,
      name: req.student.personal_data.name,
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
    };

    res.status(200).json({
      message: msg,
      data: { core, electives, results },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Operation on course
 */
exports.courses = function (attachToReq = false) {
  return function (req, res, next) {
    if (req.query.course_type)
      req.query.course_type = req.query.course_type === "CORE" ? true : false;
    var courseTypeArgument =
      req.query.course_type !== undefined && !attachToReq
        ? { course_type: req.query.course_type }
        : {};
    var searchQuery = _.merge({
      student_set: req.student.student_set,
      ...courseTypeArgument,
      group: req.student.group._id,
    });
    Course.find(searchQuery)
      .populate("course", "_id course units level semester")
      .populate("group", "_id faculty department")
      .exec(function (err, courses) {
        if (err) return next(err);
        if (attachToReq) {
          req.courses = courses;
          return next();
        }
        var result = [];
        courses.forEach(function (course) {
          var reqCourse;
          if (!attachToReq) {
            if (req.query.course)
              req.query.course = req.query.course.toUpperCase();
            reqCourse = req.query.course;
          }
          if (
            course.course.course === (reqCourse || course.course.course) &&
            course.course.semester === req.app_defaults.semester &&
            course.course.level >=
              (req.student.student_set - req.student.entry_year + 1) * 100 &&
            course.course.level <=
              (req.app_defaults.academic_year - req.student.student_set + 1) *
                100
          )
            result.push(course.toJson());
        });
        if (attachToReq) {
          req.courses = result;
          return next();
        }
        res.status(200).json({ message: "", data: result });
      });
  };
};
exports.getCourseReg = function (attachToReq = false) {
  return function (req, res, next) {
    CourseReg.find({
      year_registered:
        (req.query.year_registered && !attachToReq) ||
        req.app_defaults.academic_year,
      student: req.student._id,
    })
      .populate("course", "_id course units level semester")
      .then(function (regs) {
        var result = [];
        var reg_count = 0;
        regs.forEach(function (reg) {
          req.query.semester = isNaN(parseInt(req.query.semester))
            ? req.query.semester
            : parseInt(req.query.semester);
          if (
            reg.course.semester ===
            ((req.query.semester && !attachToReq) || req.app_defaults.semester)
          ) {
            result.push(reg);
            reg_count += reg.course.units;
          }
        });
        if (attachToReq) {
          req.course_regs = result;
          req.reg_count = reg_count;
          return next();
        }
        res.status(200).json({ message: "", data: result });
      })
      .catch(function (err) {
        next(err);
      });
  };
};
exports.regCapChecker = function () {
  return function (req, res, next) {
    var student_level =
      req.app_defaults.academic_year - req.student.student_set + 1;
    if (
      student_level === req.group_defaults.levels &&
      req.app_defaults.semester >= 2 &&
      req.reg_count + req.course.units > req.group_defaults.reg_cap
    ) {
      CourseReg.find({
        year_registered: req.app_defaults.academic_year,
        student: req.student._id,
      })
        .populate("course", "units semester")
        .then(function (courses) {
          var reg_count = 0;
          courses.forEach(function (course) {
            if (course.course.semester === req.app_defaults.semester - 1)
              reg_count += course.course.units;
          });
          if (reg_count >= req.group_defaults.reg_cap)
            return res.status(400).json({
              message: "You have maxed out your registration",
              data: {},
            });
          return next();
        })
        .catch(function (err) {
          next(err);
        });
    } else if (
      (student_level < req.group_defaults.levels ||
        student_level > req.group_defaults.levels) &&
      req.reg_count + req.course.units > req.group_defaults.reg_norm
    ) {
      return res
        .status(400)
        .json({ message: "You have maxed out your registration", data: {} });
    } else {
      return next();
    }
  };
};
exports.courseReg = function (req, res, next) {
  if (
    req.validate({ course: "string|required" }) &&
    _.find(req.courses, { course: { _id: req.course._id } }) &&
    !_.find(req.course_regs, {
      course: { _id: req.course._id },
      year_registered: req.app_defaults.academic_year,
      student: req.student._id,
    })
  )
    return CourseReg.create(
      {
        course: req.course._id,
        year_registered: req.app_defaults.academic_year,
        student: req.student._id,
      },
      function (err, saved) {
        if (err) return next(err);
        var data = saved.toObject();
        data = _.merge(data, { course: req.course });
        return res.status(200).json({ message: "Course registered", data });
      }
    );
  return res.status(200).json({
    message: "Course either registered before or cannot be registered",
    data: {},
  });
};
exports.deleteCoureReg = function (req, res, next) {
  var id = req.params.id;
  CourseReg.findOne({ _id: id, reg_status: false }, function (err, course) {
    if (err) return next(err);
    if (course) {
      return course.remove(function (err, deleted) {
        if (err) return next(err);
        return res
          .status(200)
          .json({ message: "Registration deleted!", data: deleted });
      });
    }
    return res
      .status(403)
      .json({ message: "You can't delete this course", data: {} });
  });
};
exports.saveCourseReg = function (req, res, next) {
  CourseReg.findById(req.params.id, function (err, reg) {
    if (err) return next(err);
    if (reg) {
      reg.reg_status = true;
      return reg.save(function (err, saved) {
        if (err) return next(err);
        return res
          .status(200)
          .json({ message: "Course registration saved!", data: saved });
      });
    }
    return res
      .status(400)
      .json({ message: "Registration not found", data: {} });
  });
};

/**
 * Middlewares
 */
exports.groupOptions = function () {
  return function (req, res, next) {
    GroupOptions.findOne({
      set: req.student.student_set,
      group: req.student.group._id,
    })
      .then(function (defaults) {
        if (defaults) {
          req.group_defaults = defaults;
          next();
          return false;
        }
        return GroupOptions.create({
          set: req.student.student_set,
          group: req.student.group._id,
        });
      })
      .then(function (created) {
        if (created) {
          req.group_defaults = created;
          next();
        }
      })
      .catch(function (err) {
        next(err);
      });
  };
};
