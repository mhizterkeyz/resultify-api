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
const CommonFunctions = require("../commonFunctions");

/**
 * Inviting new administrators...
 */
CommonFunctions.inviteFunctions(exports, {
  first: { type: "lecturer", msg: "A lecturer's" },
  second: { type: "student", msg: "A student's" },
});

/**
 * Group Operations
 */
exports.groupRoute = function (req, res, next) {
  Group.findOne({ _id: req.params.id, group_admin: req.user._id, status: true })
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
const assignedGroupPopulated = async (query) => {
  try {
    return await query
      .populate({ path: "group_admin", select: "name email _id status" })
      .exec();
  } catch (e) {
    throw e;
  }
};
exports.getAssignedGroups = function (attachToReq = false) {
  return function (req, res, next) {
    assignedGroupPopulated(
      Group.find({ group_admin: req.user._id, status: true })
    )
      .then(function (groups) {
        var result = groups.map(function (group) {
          var g = group.toObject();
          return g;
        });
        if (attachToReq) {
          req.assigned_groups = result || {};
          req.group_or = req.assigned_groups.reduce(
            (acc, cur) => {
              return [...acc, { group: cur._id }];
            },
            [{}]
          );
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
  assignedGroupPopulated(
    Group.findOne({ _id: id, group_admin: req.user._id, status: true })
  )
    .then(function (group) {
      if (group) {
        var g = group.toObject();
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
const latestGroupDefault = async (groups, year = new Date().getFullYear()) => {
  try {
    return await groups.reduce(async (acc, group) => {
      const chk = await GroupOptions.findOne({ group: group._id, set: year });
      if (chk) return [...acc, chk];
      return [
        ...acc,
        await GroupOptions.create({ group: group._id, set: year }),
      ];
    }, []);
  } catch (e) {
    throw e;
  }
};
exports.getAllGroupDefaults = async (req, res, next) => {
  try {
    await latestGroupDefault(req.assigned_groups);
    const options = await GroupOptions.find({ $or: req.group_or }).populate({
      path: "group",
      select: "faculty status department _id group_admin",
      populate: { path: "group_admin", select: "name email _id status" },
    });
    const done = [];
    const optionsRearranged = options.reduce((acc, cur) => {
      return _.merge(acc, {
        [`${cur.set - 1}/${cur.set}`]: { [cur.group.department]: cur },
      });
    }, {});
    return res.status(200).json({ message: "", data: optionsRearranged });
  } catch (e) {
    return next(e);
  }
};
exports.getGroupDefault = function (attachToReq = false) {
  return function (req, res, next) {
    const { id: _id, set } = req.params;
    GroupOptions.findOne({ _id, set, $or: req.group_or })
      .populate({
        path: "group",
        select: "_id faculty department group_admin",
        populate: { path: "group_admin", select: "name email _id status" },
      })
      .exec()
      .then(function (options) {
        if (options) {
          if (attachToReq) {
            req.group_defaults = options;
            next();
          }
          return res.status(200).json({ message: "", data: options });
        }
        return res
          .status(404)
          .json({ message: "Options not initiated yet", data: {} });
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
exports.newGroupDefault = (attachToReq = false) => async (req, res, next) => {
  if (
    !req.validate({
      faculty: "string|required",
      department: "string|required",
      set: "number",
    })
  )
    return;
  const { set } = req.body;
  try {
    const [{ _id }] = await latestGroupDefault([req.group], set);
    const def = await GroupOptions.findOne({ _id })
      .populate({
        path: "group",
        select: "group_admin faculty department status _id",
        populate: { path: "group_admin", select: "name email _id status" },
      })
      .exec();
    if (attachToReq) {
      req.group_defaults = def;
      return next();
    }
    return res.status(200).json({ message: "", data: def });
  } catch (e) {
    return next(e);
  }
};

/**
 * Lecturer Operations
 */
exports.getLecturers = async (req, res, next) => {
  try {
    const lecturers = await Lecturers.find()
      .populate("personal_info", "_id name email status")
      .populate({
        path: "group",
        select: "_id faculty department status group_admin",
        populate: { path: "group_admin", select: "name email _id status" },
      })
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
exports.getOneLecturer = async (req, res, next) => {
  const _id = req.params.id;
  const $or = req.group_or;
  try {
    const lecturer = await Lecturers.findOne({ _id, $or })
      .populate("personal_info", "name email _id status")
      .populate({
        path: "group",
        select: "_id faculty department status group_admin",
        populate: { path: "group_admin", select: "name email _id status" },
      })
      .exec();
    if (!lecturer)
      return res.status(404).json({ message: "Lecturer not found", data: {} });
    return res.status(200).json({ message: "", data: lecturer });
  } catch (e) {
    return next(e);
  }
};
const userStateToggle = async (req, res, next, message, state, user_role) => {
  var _id = req.params.id;
  try {
    const lecturer = await Users.findOne({ _id, user_role });
    if (!lecturer)
      return res.status(404).json({ message: "Could not find", data: {} });
    lecturer.status = state;
    return res.status(200).json({
      message,
      data: (await lecturer.save()).toJson(),
    });
  } catch (e) {
    return next(e);
  }
};
const lecturerOwnershipCheck = async (req, res, next) => {
  const _id = req.params.id;
  try {
    const lecturer = await Lecturers.findOne({ _id, $or: req.group_or });
    if (!lecturer) {
      res.status(404).json({ message: "Lecturer not found", data: {} });
      return false;
    }
    req.params.id = lecturer.personal_info;
    return true;
  } catch (e) {
    next(e);
    return false;
  }
};
exports.deleteLecturer = async (req, res, next) => {
  (await lecturerOwnershipCheck(req, res, next)) &&
    userStateToggle(
      req,
      res,
      next,
      "Lecturer blocked",
      false,
      "lecturer",
      "Could not find lecturer"
    );
};
exports.unblockLecturer = async (req, res, next) => {
  (await lecturerOwnershipCheck(req, res, next)) &&
    userStateToggle(req, res, next, "Lecturer unblocked", true, "lecturer");
};
/**
 * Student Operations
 */
exports.getStudents = async (req, res, next) => {
  try {
    const students = await Students.find({ $or: req.group_or })
      .populate("personal_data", "name email _id status")
      .populate({
        path: "group",
        select: "faculty department _id status group_admin",
        populate: {
          path: "group_admin",
          select: "name email status _id",
        },
      })
      .exec();
    return res.status(200).json({ message: "", data: students });
  } catch (e) {
    return next(e);
  }
};
exports.studentParamRoute = async (req, res, next) => {
  const _id = req.params.id;
  try {
    const student = await Students.findOne({ _id, $or: req.group_or })
      .populate("personal_data", "name email _id status")
      .populate({
        path: "group",
        select: "faculty department _id status group_admin",
        populate: { path: "group_admin", select: "name email status _id" },
      })
      .exec();
    if (!student)
      return res.status(404).json({ message: "Student not found", data: {} });
    req.student = student;
    return next();
  } catch (e) {
    return next(e);
  }
};
exports.getOneStudent = function (req, res, next) {
  return res.status(200).json({ message: "", data: req.student });
};
exports.deleteStudent = (req, res, next) => {
  req.params.id = req.student.personal_data._id;
  userStateToggle(req, res, next, "Student blocked", false, "student");
};
exports.updateStudent = (req, res, next) => {
  req.params.id = req.student.personal_data._id;
  userStateToggle(req, res, next, "Student unblocked", true, "student");
};

/**
 * Course Operations
 */
exports.getCourses = async (req, res, next) => {
  req.group_or = req.group_or.reduce(
    (acc, cur) => [...acc, { added_by: cur.group }],
    []
  );
  try {
    const courses = await Course.find({
      $or: [{ status: true }, ...req.group_or],
    })
      .populate({
        path: "added_by",
        select: "faculty department status _id group_admin",
        populate: {
          path: "group_admin",
          select: "name email _id status",
        },
      })
      .populate({
        path: "lecturer",
        select: "personal_info _id group",
        populate: {
          path: "group personal_info",
          select: "faculty name email department _id status group_admin",
          populate: { path: "group_admin", select: "name email _id status" },
        },
      });
    return res.status(200).json({ message: "", data: courses });
  } catch (e) {
    return next(e);
  }
};
exports.addCourse = async (req, res, next) => {
  if (
    !req.validate({
      course: "string|required",
      title: "string|required",
      units: "number|required",
      faculty: "string|required",
      department: "string|required",
      semester: "number|required",
      level: "number|required",
      lecturer: "string",
    })
  )
    return;
  req.body.course = req.body.course.toUpperCase();
  const { department, faculty, course, title } = req.body;
  try {
    const validateGroup = await Group.findOne({
      faculty,
      department,
    });
    if (!validateGroup)
      return res.status(404).json({
        message: "Invalid faculty or department provided",
        data: {},
      });
    const dupCourse = await Course.findOne({ $or: [{ course }, { title }] });
    if (dupCourse)
      return res
        .status(404)
        .json({ message: "Duplicate courses not allowed", data: {} });
    const created = await Course.create({
      ...req.body,
      added_by: validateGroup._id,
    });
    if (req.body.lecturer) {
      await Utils.notify(
        req.body.lecturer,
        `${created.course} has been assigned to you.`
      );
    }
    return res.status(200).json({ message: "Course created!", data: created });
  } catch (e) {
    return next(e);
  }
};
exports.getOneCourse = function (attachToReq = false) {
  return function (req, res, next) {
    req.group_or = req.group_or.reduce(
      (acc, cur) => [...acc, { added_by: cur.group }],
      []
    );
    var _id = req.params.id;
    Course.findOne({ _id, $or: [{ status: true }, ...req.group_or] })
      .populate({
        path: "added_by",
        select: "faculty department _id status group_admin",
        populate: { path: "group_admin", select: "name email _id status" },
      })
      .populate({
        path: "lecturer",
        select: "personal_info group",
        populate: {
          path: "personal_info group",
          select: "name email _id status faculty department group_admin",
          populate: { path: "group_admin", select: "name email status _id" },
        },
      })
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
exports.deleteCourse = async (req, res, next) => {
  if (!_.find(req.assigned_groups, { _id: req.course.added_by._id }))
    return res.status(403).json({
      message: "You cannot block this course",
      data: {},
    });
  req.course.status = false;
  try {
    const course = await req.course.save();
    return res.status(200).json({ message: "Course blocked", data: course });
  } catch (e) {
    return next(e);
  }
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
        if (group && _.find(req.assigned_groups, { _id: group._id })) {
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
const groupCoursePopulated = async (query) => {
  try {
    return query
      .populate({
        path: "course group",
        select:
          "course _id title units level semester lecturer faculty department status group_admin",
        populate: {
          path: "lecturer group_admin",
          select: "personal_info group name email status _id",
          populate: {
            path: "personal_info group",
            select: "name email status _id faculty department group_admin",
            populate: { path: "group_admin", select: "name email status _id" },
          },
        },
      })
      .exec();
  } catch (e) {
    throw e;
  }
};
exports.getGroupCourses = async (req, res, next) => {
  try {
    const courses = await groupCoursePopulated(
      GroupCourse.find({ $or: req.group_or })
    );
    return res.status(200).json({ message: "", data: courses });
  } catch (e) {
    return next(e);
  }
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
        course.course_type = req.body.course_type;
        return course.save();
      }
      return GroupCourse.create({
        course: req.course._id,
        course_type: req.body.course_type,
        group: req.group._id,
        student_set: req.body.student_set,
      });
    })
    .then(function (course) {
      return groupCoursePopulated(GroupCourse.findById(course._id));
    })
    .then((created) =>
      res.status(200).json({ message: "Group course added!", data: created })
    )
    .catch(function (err) {
      return next(err);
    });
};
exports.getOneGroupCourse = function (attachToReq = false) {
  return function (req, res, next) {
    var _id = req.params.id;
    groupCoursePopulated(GroupCourse.findOne({ _id, $or: req.group_or }))
      .then(function (course) {
        if (course) {
          if (attachToReq) {
            req.group_course = course;
            return next();
          }
          return res.status(200).json({ message: "", data: course });
        }
        return res.status(200).json({ message: "Course not found!", data: {} });
      })
      .catch((err) => next(err));
  };
};
exports.deleteGroupCourse = async (req, res, next) => {
  req.group_course.status = false;
  try {
    const course = await req.group_course.save();
    return res.status(200).json({
      message: "Course blocked!",
      data: await groupCoursePopulated(GroupCourse.findById(course._id)),
    });
  } catch (e) {
    return next(e);
  }
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
    .then((course) => groupCoursePopulated(GroupCourse.findById(course._id)))
    .then(function (saved) {
      return res.status(200).json({ message: "Course updated!", data: saved });
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
  Invites.findOne({ _id: req.body.invite_token, status: 0 }, function (
    err,
    invite
  ) {
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
        invite.status = 1;
        invite.save();
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
  if (req.body.status) delete req.body.status;
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
