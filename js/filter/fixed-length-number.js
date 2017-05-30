/**
 * This filter is for number field formatting. To set fixed length number, and have leading zero when the value is short.
 *
 * @author      Pan Khantidhara
 * @version     1.0.0
 * @since       2014-04-04
 *
 * Library dependencies
 ** AngularJS 1.2.7
 *
 * Code dependencies
 *
 * Configurations
 ** (r) 
 **
 * Attributes for <tgapsummaryresults>
 ** (o)
 **
 **
 **/

angular.module('numberFixedLenFilter', []).

filter('numberFixedLen', function () {
    return function (n, len) {
        var num = parseInt(n, 10);
        len = parseInt(len, 10);
        if (isNaN(num) || isNaN(len)) {
            return n;
        }
        num = '' + num;
        while (num.length < len) {
            num = '0' + num;
        }
        return num;
    };
});