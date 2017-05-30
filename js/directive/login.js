/**
 * This directive will create a login form.
 *
 * @author      Pan Khantidhara
 * @version     1.2.0
 * @since       2014-02-18
 * 
 * Update history
 * 1.1.0 (2014-05-01) - Retain previously entered username
 * 1.2.0 (2015-02-04) - Change log in logic so it doesn't use hardcoded endpoint
 *
 * Library dependencies
 ** JQM 1.4.0
 ** sForce Ajax Toolkit 2.9
 ** AngularJS 1.2.7
 *
 * Code dependencies
 ** /html/partial/login.html
 ** /css/partial/login.less
 *
 * Configurations
 ** (r) orgUrl - sForce org URL
 ** (o) isDebugMode - Turn on/off debug mode
 **
 * Attributes for <login>
 ** (r) pageId - Login page ID.
 **/

angular.module('loginDirective', []).

directive('login', function () {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/login.html',
        scope: {
            pageId: '@'
        },
        link: function (scope, element, attr) {
        },
        controller: function ($scope, $element, $timeout, $rootScope) {
            $scope.appVersion = $rootScope.appVersion;
            $scope.orgName = window.orgName;

            if (window.isDebugMode) {
                //$scope.username = 'FDACS@basicgov.com';
                //$scope.password = 'BaGov014a';
            }

            var localStoragePriorUsername = window.localStorage.getItem('LastLoginUsername');
            if (localStoragePriorUsername) {
                $scope.username = localStoragePriorUsername;
            }

            function loginRemote(username, password) {
                // Format the login request.
                var jsonOption = {
                    type: "POST",
                    cache: false,
                    url: window.oauthTokenUrl,
                    headers: { Accept: "application/json" },
                    data: {
                        grant_type: "password",
                        client_id: window.clientId,
                        client_secret: window.clientSecret,
                        username: username,
                        password: password
                    },
                    dataType: "json"
                };

                // Perform the request and process the response.
                $.ajax(jsonOption).done(function (data, status, err) {
                    $scope.loginForm.password.$setValidity('wrongUsernamePassword', true);
                    $scope.loginForm.password.$setValidity('sfError', true);
                    $scope.$apply();

                    // Set the session ID.
                    sforce.connection.sessionId = data.access_token;

                    // Set the toolkit's server URL.
                    sforce.connection.serverUrl = data.instance_url + '/services/Soap/u/29.0';

                    $rootScope.$emit('loggedIn', {
                        username: $scope.username
                    });

                    // Save a hash of the username/password locally.
                    var LoginHash = window.hashCode(username + password);
                    var localStorageLoginHash = window.localStorage.getItem('LoginHash');
                    var loginHashFound = false;
                    if (localStorageLoginHash) {
                        var localStorageLoginHashes = JSON.parse(localStorageLoginHash);
                        $.each(localStorageLoginHashes, function (index, loginHash) {
                            if (loginHash == LoginHash) {
                                loginHashFound = true;
                                return false;
                            }
                        });
                        if (!loginHashFound) {
                            localStorageLoginHashes.push(LoginHash);
                            window.localStorage.setItem('LoginHash', JSON.stringify(localStorageLoginHashes));
                        }
                    } else {
                        window.localStorage.setItem('LoginHash', JSON.stringify([LoginHash]));
                    }
                    window.hideLoadingMask();
                }).fail(function (xhr, status, err) {
                    if(xhr.responseJSON){
                        $scope.loginErrorMsg = xhr.responseJSON.error_description;
                    } else {
                        $scope.loginErrorMsg = 'unknown';
                    }
                    $scope.loginForm.password.$setValidity('sfError', false);
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                    window.hideLoadingMask();
                });
            }

            function loginLocally(username, password) {
                // Login hash
                var LoginHash = window.hashCode(username + password);
                var localStorageLoginHash = window.localStorage.getItem('LoginHash');
                var loginHashFound = false;

                if (!localStorageLoginHash) {
                    console.error('LoginFail');
                } else {
                    var localStorageLoginHashes = JSON.parse(localStorageLoginHash);
                    $.each(localStorageLoginHashes, function (index, loginHash) {
                        if (loginHash == LoginHash) {
                            $rootScope.$emit('loggedIn', {
                                username: $scope.username
                            });
                            loginHashFound = true;
                            return false;
                        }
                    });

                    if (!loginHashFound) {
                        $scope.loginForm.password.$setValidity('wrongUsernamePassword', false);
                        if (!$scope.$$phase) {
                            $scope.$apply();
                        }
                    }
                    window.hideLoadingMask();
                }
            };

            $scope.login = function (username, password) {
                window.showLoadingMask("<h2>Starting Application...</h2><p>The application is loading.</p>");
                window.localStorage.setItem('LastLoginUsername', username);
                if (navigator.connection.type != Connection.NONE) {
                    if (window.isDebugMode) {
                        navigator.notification.alert('--- LOGIN REMOTE ---', '--- ONLINE ---');
                    }
                    loginRemote(username, password);
                } else {
                    if (window.isDebugMode) {
                        navigator.notification.alert('--- LOGIN LOCAL ---', '--- OFFLINE ---');
                    }
                    loginLocally(username, password);
                }
            };

            $rootScope.$on('loggedOut', function (event, arg) {
                $.mobile.pageContainer.pagecontainer('change', '#' + $scope.pageId, {
                    transition: 'slide',
                    reverse: true
                });
            });

            $scope.useSandboxChange = function(){
                if($scope.useSandbox){
                    window.oauthTokenUrl = 'https://test.salesforce.com/services/oauth2/token';
                } else {
                    window.oauthTokenUrl = 'https://login.salesforce.com/services/oauth2/token';
                }
            };

            $scope.debugModeOnChange = function(){
                if($scope.debugModeOn){
                    window.isDebugMode = true;
                } else {
                    window.isDebugMode = false;
                }
            };
        }
    };
});