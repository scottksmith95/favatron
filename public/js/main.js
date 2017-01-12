$(function(){
  // Call the functions in helper.js
  MBP.scaleFix();
  MBP.hideUrlBarOnLoad();
  MBP.enableActive();
  MBP.preventZoom();
  MBP.startupImage();

  // Click hamburger icon
  $('.menu-trigger').on('click', function(){
    // Show nav menu
    $('.simple-header nav').toggleClass('show');
  });

  var currentDate;
  var showDate = false;
  $('.pretty-date').each(function(index, item) {
    var toLocalTime = function(time) {
      var d = new Date(time);
      var offset = (new Date().getTimezoneOffset() / 60) * -1;
      var n = new Date(d.getTime() + offset);
      return n;
    };

    var localDate = toLocalTime($(item).text());
    var prettyDate = moment(localDate).format('dddd, MMMM Do');

    if (currentDate !== prettyDate) {
      currentDate = prettyDate;
      showDate = true;
    } else {
      showDate = false;
    }

    if (showDate) {
      $(item).text(prettyDate);
      $(item).show();
      $($(item).parent('h4')).children('.pretty-date-icon').show();
    }
    else {
      $(item).parent('h4').remove();
    }
  });
});
