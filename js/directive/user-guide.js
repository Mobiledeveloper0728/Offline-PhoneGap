/**
 * This directive will create a login form.
 *
 * @author      Pan Khantidhara
 * @version     1.0.0
 * @since       2014-03-19
 *
 * Library dependencies
 ** JQM 1.4.0
 ** AngularJS 1.2.7
 *
 * Code dependencies
 ** /html/partial/user-guide.html
 ** /css/partial/user-guide.less
 *
 * Configurations
 ** (o) isDebugMode - Turn on/off debug mode
 **
 * Attributes for <userguide>
 ** 
 **/

angular.module('userGuideDirective', []).

directive('userguide', function () {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/user-guide.html',
        scope: {
            pageId: '@'
        },
        link: function (scope, element, attr) {
        },
        controller: function ($scope, $element, $rootScope) {

        }
    };
});