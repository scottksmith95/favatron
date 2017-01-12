module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json')
  });

  grunt.loadNpmTasks('grunt-nsp-package');

  // Default task(s).
  grunt.registerTask("default", 'validate-package');

};