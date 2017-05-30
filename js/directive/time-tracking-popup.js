/**
 * This directive will create a popup with time tracking information for billing and scheduling purpose.
 *
 * @author      Pan Khantidhara
 * @version     1.1.0
 * @since       2014-02-19
 *
 * Update history
 * 1.1.0 (2014-05-06) - Combine hour and minute into minute field
 *
 * Library dependencies
 ** JQM 1.4.0
 ** AngularJS 1.2.7
 *
 * Code dependencies
 ** /html/partial/time-tracking-popup.html
 ** /css/partial/popups.less
 *
 * Configurations
 ** (r) sfOauthToken - sForce access token
 ** (r) orgUrl - sForce org URL
 ** (r) db - Database connection
 ** (o) pageTransition - JQM page transition style, defaulted to 'slide'.
 ** (o) questionQuery - SOQL for retrieveing question list
 ** (o) isDebugMode - Turn on/off debug mode
 **
 * Attributes for <timetrackingpopup>
 ** (o) questionextraspageid - DOM id of JQM container page, which contains <questionextras>.
        This value is used to display question extras page. The default is 'question-extra-page'.
 **
 **
 **/

angular.module('timeTrackingPopupDirective', []).

directive('timetrackingpopup', function () {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/time-tracking-popup.html',
        scope: {
        },
        link: function (scope, element, attr) {
            $(function () {
                $("#time-tracking-popup").enhanceWithin().popup();
            });
        },
        controller: function ($scope, $element, $timeout, $rootScope, $filter) {
            $rootScope.$on('openTimeTrackingPopup', function (event, arg) {
                $scope.inspection = arg.inspection;
                $scope.showEndTime = false;
                $scope.showBreakTime = false;
                $scope.status = arg.status;
				$scope.showNote = false; // If this is a midway cancel, show general note box

                $scope.isCancelInspection = arg.isCancelInspection;
                if ($scope.isCancelInspection) {
                    $scope.title = 'Cancel Inspection';
					if($scope.inspection.StartTime){
					    $scope.showNote = true;
					    $scope.showEndTime = true;
					    $scope.showBreakTime = true;
					}
                }

                $scope.isEndInspection = arg.isEndInspection;
                if ($scope.isEndInspection) {
                    $scope.showEndTime = true;
                    $scope.showBreakTime = true;
                    $scope.title = 'Complete Inspection';
                }
                $scope.endTimeHr = moment().hour();
                $scope.endTimeMin = moment().format('mm');
                $scope.breakTimeMin = '';
                $scope.travelTimeMin = '';
                $scope.reinspectionDate = '';
                $scope.cbFn = arg.cbFn; // Callback function

                if ($scope.showEndTime) {
                    if ($scope.timeTrackingForm.endTimeHr) {
                        $scope.timeTrackingForm.endTimeHr.$setValidity('endEarlierThanStart', true);
                    }
                }

                $('#time-tracking-popup').popup('open', {
                    positionTo: 'window'
                });
                $(timeTrackingForm.travelTimeMin).focus();

                $scope.showErrors = false; //hide errors in pop-up
            });

            $scope.finish = function () {
                var isFormValid = true;

                if ($scope.isCancelInspection) {
                    if ($scope.timeTrackingForm.$valid) {
                        $scope.cancelInspection();
                    } else {
                        $scope.showErrors = true; //show errors in pop-up
                    }
                } else if ($scope.isEndInspection) {
                    $scope.timeTrackingForm.endTimeHr.$setValidity('endEarlierThanStart', true);

                    if (moment($scope.endTimeHr + ':' + parseInt($scope.endTimeMin), window.timeFormat).isBefore(moment($scope.inspection.StartTime, window.timeFormat))) {
                        isFormValid = false;
                        $scope.timeTrackingForm.endTimeHr.$setValidity('endEarlierThanStart', false);
                    }

                    if (!$scope.timeTrackingForm.$valid) {
                        isFormValid = false;
                    }

                    if (isFormValid) {
                        $scope.cbFn({
                            travelTimeMin: $scope.travelTimeMin,
                            reinspectionDate: $scope.reinspectionDate,
                            endTimeHr: $scope.endTimeHr,
                            endTimeMin: $scope.endTimeMin,
                            breakTimeMin: $scope.breakTimeMin
                        });
                    } else {
                        $scope.showErrors = true; //show errors in pop-up
                    }
                }
            };
        }
    };
});