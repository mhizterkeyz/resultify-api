var Invites = require("../models/invitesModel");
var Users = require("../models/usersModel");
var Lecturers = require("../models/lecturersModel");
var Group = require("../models/institutionalGroupsModel");
var GroupOptions = require("../models/groupOptionsModel");
var Course = require("../models/coursesModel");
var Students = require("../models/StudentsModel");
var GroupCourse = require("../models/groupCoursesModel");
var CourseReg = require("../models/courseRegModel");
var Results = require("../models/resultsModel");
var Utils = require("../../utils/util");
var SignToken = require("../../auth/auth").signToken;
var _ = require("lodash");

/**
 * Inviting new administrators...
 */
exports.getInvites = function (req, res, next) {
  Invites.find({ $or: [{ role: "lecturer" }, { role: "student" }] }).then(
    function (invites) {
      var invite = invites.map(function (elem) {
        return elem.toJson();
      });
      res.status(200).json({
        message: "",
        data: invite,
      });
    },
    function (err) {
      next(err);
    }
  );
};
exports.newInvite = function (req, res, next) {
  if (
    !req.validate({
      type: "required|boolean",
    })
  )
    return;
  var inviteType = req.body.type ? "student" : "lecturer";
  Invites.create({ role: inviteType, created_at: Date.now().toString() }).then(
    function (saved) {
      res.status(200).json({
        message: "Invite Created!",
        data: saved.toJson(),
      });
    },
    function (err) {
      next(err);
    }
  );
};
exports.deleteInvite = function (req, res, next) {
  var id = req.params.invite_id;
  Invites.findByIdAndDelete(id, function (err, removed) {
    if (err) return next(err);
    if (removed)
      return res.status(200).json({
        message: "Invite deleted!",
        data: removed,
      });
    return res.status(404).json({
      message: "Could not find invite",
      data: {},
    });
  });
};
exports.getOneInvite = function (req, res, next) {
  var id = req.params.invite_id;
  Invites.findById(id, function (err, invite) {
    if (err) return next(err);
    if (invite)
      return res.status(200).json({
        message: "",
        data: invite.toJson(),
      });
    return res.status(404).json({
      message: "Could not find invite",
      data: {},
    });
  });
};
exports.updateInvite = function (req, res, next) {
  if (
    !req.validate({
      type: "required|boolean",
    })
  )
    return;
  var id = req.params.invite_id;
  if (req.body.id) delete req.body.id;
  if (req.body.created_at) delete req.body.created_at;
  req.body.role = req.body.type ? "student" : "lecturer";
  if (req.body.type) delete req.body.type;
  Invites.findById(id, function (err, invite) {
    if (err) return next(err);
    if (invite) {
      _.merge(invite, req.body);
      return invite.save(function (err, saved) {
        if (err) return next(err);
        return res.status(200).json({
          message: "Invite updated!",
          data: saved,
        });
      });
    }
    return res.status(404).json({
      message: "Could not find invite.",
      data: {},
    });
  });
};

/**
 * Group Operations
 */
exports.groupRoute = function (req, res, next) {
  Group.findOne({ _id: req.params.id, group_admin: req.user._id })
    .then(function (group) {
      if (group) {
        req.group = group;
        return next();
      }

      res.status(404).json({
        message: "No group with that ID was assigned to you.",
        data: {},
      });
    })
    .catch(function (err) {
      next(err);
    });
};
exports.getAssignedGroups = function (attachToReq = false) {
  return function (req, res, next) {
    Group.find({ group_admin: req.user._id })
      .then(function (groups) {
        var result = groups.map(function (group) {
          var g = group.toObject();
          delete g.group_admin;
          return g;
        });
        if (attachToReq) {
          req.assigned_groups = result || {};
          return next();
        }
        res.status(200).json({
          message: "",
          data: result,
        });
      })
      .catch(function (err) {
        next(err);
      });
  };
};
exports.getOneGroup = function (req, res, next) {
  var id = req.params.id;
  Group.findOne({ _id: id, group_admin: req.user._id })
    .then(function (group) {
      if (group) {
        var g = group.toObject();
        delete g.group_admin;
        return res.status(200).json({
          message: "",
          data: g,
        });
      }
      return res
        .status(404)
        .json({ message: "Could not find group.", data: {} });
    })
    .catch(function (err) {
      next(err);
    });
};
exports.getGroupDefault = function (attachToReq = false) {
  return function (req, res, next) {
    req.validate({ set: "required|number" }) &&
      GroupOptions.find({ group: req.group._id })
        .populate("group", "_id faculty department")
        .exec()
        .then(function (options) {
          if (options) {
            var opt = _.find(options, { set: req.body.set });
            if (opt) {
              if (attachToReq) {
                req.group_defaults = opt;
                next();
              } else {
                res.status(200).json({ message: "", data: opt });
              }
              return false;
            }
          }
          return GroupOptions.create({
            set: req.body.set,
            group: req.group._id,
          });
        })
        .then(function (created) {
          if (created) {
            var result = created.toObject();
            result.group = {
              _id: req.group._id,
              faculty: req.group.faculty,
              department: req.group.department,
            };
            if (attachToReq) {
              created.group = {
                _id: req.group._id,
                faculty: req.group.faculty,
                department: req.group.department,
              };
              req.group_defaults = created;
              next();
            } else {
              res.status(200).json({
                message: "",
                data: result,
              });
            }
          }
        })
        .catch(function (err) {
          next(err);
        });
  };
};
exports.updateGroupDefault = function (req, res, next) {
  if (
    !req.validate({
      grade_system: "string",
      levels: "number",
      reg_cap: "number",
      reg_norm: "number",
      reg_min: "number",
    })
  )
    return;
  if (
    req.body.grade_system &&
    !Utils.validateGradeSystem(req.body.grade_system)
  )
    return res
      .status(400)
      .json({ message: "Invalid grade system format", data: {} });
  if (req.body.group) delete req.body.group;
  if (req.body._id) delete req.body._id;
  _.merge(req.group_defaults, req.body);
  req.group_defaults.save(function (err, saved) {
    if (err) return next(err);
    return res.status(200).json({
      message: "Group options updated!",
      data: saved,
    });
  });
};

/**
 * Lecturer Operations
 */
exports.getLecturers = async (req, res, next) => {
  try {
    const lecturers = await Lecturers.find()
      .populate("personal_info", "_id name email")
      .populate("group", "_id faculty department")
      .exec();
    const result = [];
    lecturers.forEach(function (elem) {
      if (_.find(req.assigned_groups, { _id: elem.group._id }))
        result.push(elem);
    });
    res.status(200).json({
      message: "",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
exports.getOneLecturer = function (req, res, next) {
  var id = req.params.id;
  Users.findById(id)
    .then(function (user) {
      if (user)
        return Lecturers.find({ personal_info: user._id })
          .populate("personal_info", "name email _id")
          .populate("courses_assigned", "course _id")
          .populate("group", "faculty department _id")
          .exec();
      res.status(404).json({ message: "Lecturer not found!", data: {} });
      return false;
    })
    .then(function (lecturer) {
      if (lecturer)
        res.status(200).json({
          message: "",
          data: lecturer,
        });
    })
    .catch(function (err) {
      return next(err);
    });
};
exports.deleteLecturerChainUser = function (req, res, next) {
  var id = req.params.id;
  Users.findById(id)
    .then(function (user) {
      if (user) {
        req.lecturer_user = user;
        return next();
      }
      return res.status(404).json({ message: "Lecturer not found!", data: {} });
    })
    .catch(function (err) {
      return next(err);
    });
};
exports.deleteLecturerChainLecturer = function (req, res, next) {
  Lecturers.findOne({ personal_info: req.lecturer_user._id })
    .populate("personal_info", "name _id")
    .populate("courses_assigned", "course")
    .populate("group", "faculty department _id")
    .exec()
    .then(function (lecturer) {
      if (
        lecturer &&
        _.find(req.assigned_groups, { _id: lecturer.group._id })
      ) {
        req.lecturer = lecturer;
        return next();
      }
      res
        .status(403)
        .json({ message: "You can't remove this lecturer.", data: {} });
      return false;
    })
    .catch(function (err) {
      return next(err);
    });
};
exports.deleteLecturer = function (req, res, next) {
  Course.find({ lecturer: req.lecturer._id })
    .then(function (courses) {
      courses.forEach(function (elem) {
        elem.lecturer = null;
        elem.save();
      });
      req.lecturer_user.remove();
      req.lecturer.remove(function (err, removed) {
        if (err) return next(err);
        res.status(200).json({
          message:
            "Lecturer has been removed and all associated courses have no lecturer now.",
          data: {},
        });
      });
    })
    .catch(function (err) {
      next(err);
    });
};

/**
 * Student Operations
 */
exports.getStudents = function (req, res, next) {
  var findQuery = req.query;
  Students.find(findQuery)
    .populate("personal_data", "name email _id")
    .populate("group", "faculty department _id")
    .exec()
    .then(function (students) {
      var result = [];
      students.forEach(function (student) {
        if (_.find(req.assigned_groups, { _id: student.group._id }))
          result.push(student);
      });
      res.status(200).json({ message: "", data: result });
    })
    .catch(function (err) {
      return next(err);
    });
};
exports.studentParamRoute = function (req, res, next) {
  var id = req.params.id;
  Students.findById(id)
    .populate("personal_data", "name email _id")
    .populate("group", "faculty department _id")
    .exec()
    .then(function (student) {
      if (student) {
        req.student = student;
        return next();
      }
      return res.status(404).json({ message: "Student not found!", data: {} });
    })
    .catch(function (err) {
      return next(err);
    });
};
exports.getOneStudent = function (req, res, next) {
  return res.status(200).json({ message: "", data: req.student });
};
exports.deleteStudent = function (req, res, next) {
  Users.findByIdAndRemove(req.student.personal_data._id)
    .then(function (removed) {
      return req.student.remove();
    })
    .then(function (removed) {
      res
        .status(200)
        .json({ message: "Student removed successfully!", data: removed });
    })
    .catch(function (err) {
      return next(err);
    });
};

/**
 * Course Operations
 */
exports.getCourses = function (req, res, next) {
  Course.find(req.query)
    .populate("added_by", "faculty department _id")
    .populate("lecturer", "_id name email")
    .exec()
    .then(function (courses) {
      res.status(200).json({ message: "", data: courses });
    })
    .catch(function (err) {
      return next(err);
    });
};
exports.addCourse = function (req, res, next) {
  req.validate({
    course: "string|required",
    units: "number|required",
    faculty: "string|required",
    department: "string|required",
    semester: "number|required",
    level: "number|required",
    lecturer: "string",
  }) &&
    Group.findOne({
      faculty: req.body.faculty,
      department: req.body.department,
    })
      .then(function (group) {
        if (group) {
          req.body.course = req.body.course.toUpperCase();
          req.body.added_by = group._id;
          return group;
        }
        res.status(404).json({
          message: "Invalid faculty or department provided",
          data: {},
        });
      })
      .then(function (group) {
        if (group) return Course.create(req.body);
      })
      .then(function (created) {
        res.status(200).json({ message: "Course created!", data: created });
        if (req.body.lecturer) {
          Utils.notify(
            req.body.lecturer,
            `${created.course} has been assigned to you.`
          );
        }
      })
      .catch(function (err) {
        return next(err);
      });
};
exports.getOneCourse = function (attachToReq = false) {
  return function (req, res, next) {
    var id = req.params.id;
    Course.findById(id)
      .populate("added_by", "faculty department _id")
      .populate("lecturer", "personal_info")
      .populate("personal_info", "name _id email")
      .exec(function (err, course) {
        if (err) return next(err);
        if (course && attachToReq) {
          req.course = course;
          return next();
        }
        if (course) return res.status(200).json({ message: "", data: course });
        return res
          .status(404)
          .json({ message: "Could not find course!", data: {} });
      });
  };
};
exports.deleteCourse = function (req, res, next) {
  req.course.remove(function (err, removed) {
    if (err) return next(err);
    return res.status(200).json({ message: "Course deleted!", data: removed });
  });
};
exports.updateCourse = function (req, res, next) {
  if (
    !req.validate({
      course: "string",
      units: "number",
      faculty: "string",
      department: "string",
      semester: "number",
      level: "number",
      lecturer: "string",
    })
  )
    return;
  if (req.body._id) delete req.body._id;
  req.body.course = req.body.course
    ? req.body.course.toUpperCase()
    : req.body.course;
  if (req.body.faculty && req.body.department) {
    return Group.findOne({
      faculty: req.body.faculty,
      department: req.body.department,
    })
      .then(function (group) {
        if (group) {
          req.body.added_by = group._id;
          return group;
        }
        res.status(404).json({
          message: "Invalid faculty or department provided",
          data: {},
        });
      })
      .then(function (group) {
        if (group) {
          _.merge(req.course, req.body);
          return req.course.save();
        }
      })
      .then(function (saved) {
        res.status(200).json({ message: "Course updated!", data: saved });
        if (req.body.lecturer) {
          Utils.notify(
            req.body.lecturer,
            `${saved.course} has been assigned to you`
          );
        }
      })
      .catch(function (err) {
        return next(err);
      });
  }

  _.merge(req.course, req.body);
  req.course.save(function (err, saved) {
    if (err) return next(err);
    return res.status(200).json({ message: "Course updated!", data: saved });
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
              $or: [
                { result_status: 2 },
                { result_status: 3 },
                { result_status: 4 },
              ],
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
                group: student.group,
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
              $or: [
                { result_status: 2 },
                { result_status: 3 },
                { result_status: 4 },
              ],
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
                group: student.group,
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
              $or: [
                { result_status: 2 },
                { result_status: 3 },
                { result_status: 4 },
              ],
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
  if (!_.find(req.assigned_groups, { _id: req.group._id }))
    return res
      .status(403)
      .json({ message: "Group wasn't assigned to you.", data: {} });
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
      course: "required|string",
      faculty: "required|string",
      department: "required|string",
      student_set: "required|number",
      semester: "required|number",
    })
  )
    return;
  if (!_.find(req.assigned_groups, { _id: req.group._id }))
    return res
      .status(403)
      .json({ message: "Group wasn't assigned to you.", data: {} });
  try {
    const students = await Students.find({
      group: req.group._id,
      student_set: req.body.student_set,
      entry_year: { $lte: req.body.year_submitted },
    });
    await students.reduce(async (acc, cur) => {
      const result = await Results.findOne({
        course: req.course._id,
        year_submitted: req.body.year_submitted,
        result_status: 2,
        student: cur._id,
      });
      if (!result) return acc;
      result.result_status = 1;
      return [...acc, await result.save()];
    }, []);
    await Utils.notify(
      req.course.lecturer,
      `${req.course.course} results for ${req.body.faculty} ${req.body.department} in ${req.body.year_submitted} has been rejected.`,
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
  if (!_.find(req.assigned_groups, { _id: req.group._id }))
    return res
      .status(403)
      .json({ message: "Group wasn't assigned to you.", data: {} });
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
                result_status: 2,
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
        .json({ message: "You can't submit with pending results.", data: {} });
    await Promise.all(
      final_play.results.map(async (elem) => {
        elem.result_status = 3;
        return await elem.save();
      })
    );
    const administrators = await Users.find({ user_role: "administrator" });
    await Promise.all(
      administrators.map(async (elem) => {
        return await Utils.notify(
          elem._id,
          `The results for ${req.body.department} in the faculty of ${req.body.faculty} has been submitted`,
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
 * Group Courses' Operations
 */
exports.getGroupCourses = function (req, res, next) {
  if (req.query.course_type)
    req.query.course_type = req.query.course_type.toUpperCase() === "CORE";
  GroupCourse.find(req.query)
    .populate("course", "course _id units level semester lecturer")
    .populate("lecturer", "name _id email")
    .populate("group", "_id faculty department")
    .exec(function (err, courses) {
      if (err) return next(err);
      var results = [];
      courses.forEach(function (course) {
        if (_.find(req.assigned_groups, { _id: course.group._id }))
          results.push(course.toJson());
      });
      return res.status(200).json({ message: "", data: results });
    });
};
exports.createGroupCourse = function (req, res, next) {
  if (
    !req.validate({
      course: "string|required",
      course_type: "boolean|required",
      faculty: "string|required",
      department: "string|required",
      student_set: "number|required",
    })
  )
    return;
  GroupCourse.findOne({
    course: req.course._id,
    student_set: req.body.student_set,
    group: req.group._id,
  })
    .then(function (course) {
      if (course) {
        res.json({ message: "Course already exists!", data: {} }).status(400);
        return false;
      }
      return GroupCourse.create({
        course: req.course._id,
        course_type: req.body.course_type,
        group: req.group._id,
        student_set: req.body.student_set,
      });
    })
    .then(function (created) {
      if (created)
        return res
          .status(200)
          .json({ message: "Group course added!", data: created.toJson() });
    })
    .catch(function (err) {
      return next(err);
    });
};
exports.getOneGroupCourse = function (attachToReq = false) {
  return function (req, res, next) {
    var id = req.params.id;
    GroupCourse.findById(id)
      .populate("course", "_id course units semester level")
      .populate("group", "_id faculty department")
      .exec(function (err, course) {
        if (err) return next(err);
        if (course) {
          if (_.find(req.assigned_groups, { _id: course.group._id })) {
            if (attachToReq) {
              req.group_course = course;
              return next();
            }
            return res.status(200).json({ message: "", data: course.toJson() });
          }
          return res
            .status(403)
            .json({ message: "You don't the permissions for this.", data: {} });
        }
        return res.status(200).json({ message: "Course not found!", data: {} });
      });
  };
};
exports.deleteGroupCourse = function (req, res, next) {
  req.group_course.remove(function (err, deleted) {
    if (err) return next(err);
    return res
      .status(200)
      .json({ message: "Course deleted!", data: deleted.toJson() });
  });
};
exports.updateGroupCourse = function (req, res, next) {
  if (req.body.group) delete req.body.group;
  if (req.body.course) delete req.body.course;
  req.body.course = req.body.course ? req.course._id : req.body.course;
  if (req.group) req.body.group = req.group._id;
  GroupCourse.findOne({
    course: req.body.course || req.group_course.course._id,
    group: req.body.group || req.group_course.group._id,
    student_set: req.body.student_set || req.group_course.student_set,
  })
    .then(function (course) {
      if (
        course &&
        course.toObject()._id.toString() !==
          req.group_course.toObject()._id.toString()
      ) {
        return res.status(400).json({
          message: "Can't update. Course already exists with the same data!",
          data: {},
        });
      }
      _.merge(req.group_course, req.body);
      return req.group_course.save();
    })
    .then(function (saved) {
      res
        .status(200)
        .json({ message: "Course updated!", data: saved.toJson() });
    })
    .catch(function (err) {
      return next();
    });
};

/**
 * Operation on Group's Administrator
 */
exports.createGroupAdmin = function (req, res, next) {
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
      if (invite.role !== "groupAdministrator")
        return res
          .status(400)
          .json({ message: "Invalid invite token!", data: {} });
      user.user_role = invite.role;
      return Users.create(user, function (err, created) {
        if (err) return next(err);
        var access_token = SignToken(created._id);
        user = _.merge(created.toJson(), { access_token });
        invite.remove();
        return res.status(200).json({
          message: "Signup successful!",
          data: user,
        });
      });
    }
    return res.status(400).json({ message: "Invalid invite token!", data: {} });
  });
};
exports.updateAdmin = function (req, res, next) {
  if (req.body.id) delete req.body.id;
  if (req.body.user_role) delete req.body.user_role;
  _.merge(req.user, req.body);
  req.user.save(function (err, saved) {
    if (err) return next(err);
    res.status(200).json({
      message: "Account updated!",
      data: saved.toJson(),
    });
  });
};
exports.notifications = async (req, res, next) => {
  try {
    if (req.params.id)
      return res
        .status(200)
        .json({ message: "", data: await Utils.notification(req.params.id) });

    const data = await req.assigned_groups.reduce(async (acc, cur) => {
      const not = await Utils.notifications(cur._id);
      return { ...acc, [`${cur.faculty} ${cur.department}`]: not };
    }, {});
    return res.status(200).json({ message: "", data });
  } catch (err) {
    return next(err);
  }
};

/**
 * Make My Life Easy Please
 */
exports.EFAD = function (attachToReq = false) {
  return function (req, res, next) {
    if (req.body.faculty && req.body.department) {
      req.body.faculty = req.body.faculty.toLowerCase();
      req.body.department = req.body.department.toLowerCase();
      return Group.findOne({
        faculty: req.body.faculty,
        department: req.body.department,
      })
        .populate("group_admin", "name _id email")
        .exec(function (err, group) {
          if (err) return next(err);
          if (group) {
            if (
              _.find(req.assigned_groups, { _id: group._id }) ||
              attachToReq
            ) {
              req.group = group;
              return next();
            }
            return res.status(200).json({
              message: "Faculty and department is not assigned to you",
              data: {},
            });
          }
          return res.status(404).json({
            message: "Invalid faculty or department provided",
            data: {},
          });
        });
    }
    next();
  };
};
exports.extractCourse = function () {
  return function (req, res, next) {
    if (req.query.course) req.body.course = req.query.course;
    if (req.body.course) {
      var searchQuery = { course: req.body.course.toUpperCase() };
      return Course.findOne(searchQuery)
        .populate("added_by", "department _id faculty")
        .populate("lecturer", "personal_info")
        .populate("personal_info", "name _id email")
        .exec(function (err, course) {
          if (err) return next(err);
          if (course) {
            req.course = course;
            return next();
          }
          return res
            .status(200)
            .json({ message: "Could not find course!", data: {} });
        });
    }
    return next();
  };
};
