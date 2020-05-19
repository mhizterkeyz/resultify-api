const __ = (special, string) => {
  for (let i = 0; i < special.length; i++) {
    if (string.indexOf(special[i]) !== -1) return true;
  }
  return false;
};
exports.username = (username) => {
  if (username.length < 3) return "username length must be greater than 3";
  if (username.indexOf("admin") !== -1)
    return "username can't be or contain the word admin";
  if (__("`~!@#$%^&*()-=\\+|/><,}{][\"'", username))
    return 'username can only have a dot "." and/or underscore "_" as special characters';
  return true;
};
exports.password = (password) => {
  if (password.length < 8)
    return "password must be at least 8 characters long and contain at least one special character";
  if (!__("`~!@#$%^&*()-=\\+|/><,}{][\"'_.", password))
    return "password must have at least 1 special character";
  return true;
};
exports.email = (email) => {
  email = email.split("@");
  if (email.length !== 2) return "invalid email format";
  if (email[1].split(".").length !== 2) return "invalid email format";
  return true;
};
