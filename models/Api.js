module.exports.Response = function (items, page, page_size, total_count) {
  if (!items.length) {
    items = [items];
  }

  this.page = page || 1;
  this.page_size = page_size || 1;
  this.items_count = items.length;
  this.total_count = total_count || 1;
  this.has_more = page * page_size < total_count;
  this.items = items;
};

module.exports.Error = function (status, message) {
  this.status = status;
  this.message = message;
};