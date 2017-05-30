/**
 * This directive will create a box that shows the result of TGAP inspection, count of CAN and IAR and a Stop Sale button.
 *
 * @author      Pan Khantidhara
 * @version     1.0.0
 * @since       2014-02-27
 *
 * Library dependencies
 ** JQM 1.4.0
 ** AngularJS 1.2.7
 *
 * Code dependencies
 ** /html/partial/tgap-summary-results.html
 ** /css/partial/tgap-summary.less
 *
 * Configurations
 ** (r) db - Database connection
 ** (o) isDebugMode - Turn on/off debug mode
 **
 * Attributes for <tgapsummaryresults>
 ** (o)
 **
 **
 **/

angular.module('tgapSummaryResultsDirective', []).

directive('tgapsummaryresults', function () {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/tgap-summary-results.html',
        scope: {
        },
        link: function (scope, element, attr) {
        },
        controller: function ($scope, $rootScope) {
        }
    };
});