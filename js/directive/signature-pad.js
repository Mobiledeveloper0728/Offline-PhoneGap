/**
 * This directive will create a popup with note field.
 *
 * @author      Pan Khantidhara
 * @version     1.0.0
 * @since       2014-02-28
 *
 * Library dependencies
 ** JQM 1.4.0
 ** AngularJS 1.2.7
 ** Signature Pad
 *
 * Code dependencies
 ** /html/partial/signature-pad.html
 ** /css/partial/tgap-summary.less
 ** Signature Pad
 *** /lib/signaturepad/assets/jquery.signaturepad.css
 *** /lib/signaturepad/assets/flashcanvas.js
 *** /lib/signaturepad/jquery.signaturepad.min.js
 *** /lib/signaturepad/assets/json2.min.js
 *
 * Configurations
 ** (r) db - Database connection
 ** (o) isDebugMode - Turn on/off debug mode
 **
 * Attributes for <signaturepad>
 ** (o)
 **
 **
 **/

angular.module('signaturePadDirective', []).

directive('signaturepad', function () {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/signature-pad.html',
        scope: {
        },
        link: function (scope, element, attr) {
            $(function () {
                window.signaturePad = $('#signature-container').signaturePad({
                    drawOnly: true,
                    lineTop: 98,
                    errorMessageDraw: 'Please have the respondent sign below to accept the inspection result.',
                    defaultAction: 'drawIt'
                });
            });
        },
        controller: function ($scope, $element, $timeout, $rootScope) {
        }
    };
});
