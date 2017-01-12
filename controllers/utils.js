var Api = require('../models/Api');

module.exports.returnError = function(status, message, res) {
  if (status === '500') console.log(message);
  res.status(status);
  res.json(new Api.Error(status, message));
};