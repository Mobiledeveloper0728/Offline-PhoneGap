/**
 * This directive will create a popup with note field.
 *
 * @author      Pan Khantidhara
 * @version     1.0.0
 * @since       2014-02-26
 *
 * Library dependencies
 ** JQM 1.4.0
 ** AngularJS 1.2.7
 *
 * Code dependencies
 ** /html/partial/note-popup.html
 ** /css/partial/popups.less
 *
 * Configurations
 ** (r) db - Database connection
 ** (o) isDebugMode - Turn on/off debug mode
 **
 * Attributes for <notepopup>
 ** (o)
 **
 **
 **/

angular.module('notePopupDirective', []).

directive('notepopup', function () {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/note-popup.html',
        scope: {
        },
        link: function (scope, element, attr) {
            $(function () {
                $("#note-popup").enhanceWithin().popup({
                    afteropen: function() {
                        $("#field-note").focus();
                    }
                });
            });
        },
        controller: function ($scope, $element, $timeout, $rootScope) {
            $rootScope.$on('addNote', function (event, arg) {
                $scope.saveObject = arg.saveObject;
                $scope.title = arg.title;
                $scope.notes = arg.notes;
                $scope.cbFn = arg.cbFn; // Callback function

                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            });

            $scope.save = function () {
                $scope.saveObject.Notes = $scope.notes;
                $scope.cbFn({
                    saveObject: $scope.saveObject,
                    notes: $scope.notes
                });
            }
        }
    };
});