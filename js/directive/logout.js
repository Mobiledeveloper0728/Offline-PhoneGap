/**
 * This directive will create a logout button.
 *
 * @author      Pan Khantidhara
 * @version     1.0.0
 * @since       2014-02-18
 *
 * Library dependencies
 ** JQM 1.4.0
 ** AngularJS 1.2.7
 *
 * Configurations
 ** (r) sfOauthToken - sForce access token
 ** (o) isDebugMode - Turn on/off debug mode
 *
 **/

angular.module('logoutDirective', []).

directive('logout', function () {
    return {
        restrict: 'AE',
        template: '<a href="#" class="ui-btn ui-btn-d ui-corner-all ui-btn-left ui-icon-arrow-l ui-btn-icon-left" data-role="button" ng-click="logout()">Log Out</a>',
        link: function (scope, element, attr) {
        },
        controller: function ($scope, $element, $timeout, $rootScope) {
            $scope.logout = function () {
                window.sfOauthToken = null;
                $rootScope.$emit('loggedOut');
            }
        }
    };
});