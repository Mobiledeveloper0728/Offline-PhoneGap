/**
 * This directive will create a bookmark on the left side of the screen.
 *
 * @author      Pan Khantidhara
 * @version     1.0.0
 * @since       2014-01-20
 *
 * Library dependencies
 ** JQM 1.4.0
 ** sForce Ajax Toolkit 2.9
 ** AngularJS 1.2.7
 *
 * Code dependencies
 ** /html/partial/bookmark.html
 ** /css/partial/bookmark.less
 *
 * Configurations
 ** (r) sfOauthToken - sForce access token
 ** (r) orgUrl - sForce org URL
 ** (o) bookmarkQuery - SOQL for retrieveing bookmark list
 ** (o) isDebugMode - Turn on/off debug mode
 **/

angular.module('bookmarkDirective', []).

directive('bookmark', function () {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/bookmark.html',
        link: function (scope, element, attr) {
            var expandedBookmark = $(element).children('#bookmarks-expand-container');
            var collapsedBookmark = expandedBookmark.siblings('#bookmarks-collapse-container');
            var mainContent = $('#main-checklist-page .ui-content');
            expandedBookmark.on('panelbeforeopen', function (event) {
                collapsedBookmark.css('width', 0);
                mainContent.css('margin-left', '0');
            });
            expandedBookmark.on('panelbeforeclose', function (event) {
                collapsedBookmark.css('width', 'auto');
                mainContent.css('margin-left', '145px');
            });
        },
        controller: function ($scope, $element, $timeout, $rootScope) {
            $scope.sectionCompletedCount = 0;
            $scope.isViewMode = false;

            // Display bookmarks
            $scope.getBookmark = function (locationType, version) {
                window.showLoadingMask('<h2>Inspection Loading...</h2><p>Your inspection is loading.</p>');
                $scope.bookmarks = JSON.parse(localStorage.getItem(locationType + "Bookmark" + version));
                if (isDebugMode) {
                    navigator.notification.alert(localStorage.getItem(locationType + "Bookmark" + version), null, locationType + 'Bookmark');
                }
                $timeout(function () {
                    $($element).find('ul').listview('refresh'); //Calls jQuery to re-render
                    window.hideLoadingMask();
                }, 0);
            };

            // Sync down bookmark section from SF and store it in local storage
            $scope.downloadBookmark = function (locationType, version) {
                if (!localStorage.getItem(locationType + "Bookmark" + version)) {
                    window.showLoadingMask('<h2>Starting Application...</h2><p>The application is loading.</p>');

                    var bookmarkQuery = window.bookmarkQuery ? window.bookmarkQuery : "SELECT BGCK__Page__r.Id, BGCK__Page__r.Name, BGCK__Page__r.BGCK__Order__c FROM BGCK__Checklist_Version__c WHERE BGCK__Page__r.BGCK__Type__c = 'Section' AND BGCK__Question__c = NULL AND BGCK__Checklist__r.BGCK__Object_Value__c = '" + locationType + "' AND BGCK__Version__c = " + version + " ORDER BY BGCK__Page__r.BGCK__Order__c";
                    if (window.isDebugMode) {
                        console.log('bookmark controller sforce query= ' + bookmarkQuery);
                    }
                    sforce.connection.query(bookmarkQuery, {
                        onSuccess: function (result) {
                            if (window.isDebugMode) {
                                console.log('bookmark controller sforce query result= ' + JSON.stringify(result));
                                console.log('bookmark controller sforce query result size= ' + result.size);
                            }
                            $scope.bookmarks = [];
                            $.each(result.getArray('records'), function (index, bookmark) {
                                var cleanBookmark = {
                                    Id: bookmark.BGCK__Page__r.Id,
                                    Name: bookmark.BGCK__Page__r.Name,
                                    Order: bookmark.BGCK__Page__r.BGCK__Order__c
                                }
                                $scope.bookmarks.push(cleanBookmark);
                            });

                            localStorage.setItem(locationType + "Bookmark" + version, JSON.stringify($scope.bookmarks));
                            window.hideLoadingMask();

                            $rootScope.$emit('updateQuestionsVersion', {
                                locationType: locationType,
                                version: version
                            });
                            $scope.bookmarks = null;
                        },
                        onFailure: function (error) {
                            //TODO: take care of error handling
                            window.hideLoadingMask();
                        }
                    });
                } else {
                    window.hideLoadingMask();
                }
            };

            // Checklist validation
            $scope.validateAllChecklist = function () {
                if (window.isDebugMode) {
                    console.log('$scope.validateAllChecklist= start validation');
                }
                if($scope.bookmarks){
                    var sectionCompleted = true;
                    $.each($scope.bookmarks, function (index, page) {
                        // Check if this section is completed
                        $('#question-container tr[data-pageid=' + page.Id + ']').each(function (index, element) {
                            if (!$(element).find('input')[0].validity.valid && $(element).find('input[type=hidden]').val() == 'false') { // Found one question that's incompleted
                                if (window.isDebugMode) {
                                    console.log('$scope.validateAllChecklist= section incompleted ' + page.Id);
                                }
                                sectionCompleted = false;
                                return false;
                            }
                        });

                        if (sectionCompleted) {
                            if (window.isDebugMode) {
                                console.log('$scope.validateAllChecklist= section completed ' + page.Id);
                            }
                            $rootScope.$emit('sectionCompleted', {
                                pageId: page.Id
                            });
                        }
                    });
                }
            };

            $rootScope.$on('answersFilled', function (event, arg) {
                $scope.validateAllChecklist();
            });

            $rootScope.$on('startInspection', function (event, arg) {
                if(arg.inspection.ChecklistVersion != 'undefined'){
                    $scope.getBookmark(arg.type, arg.inspection.ChecklistVersion);
                }
                $scope.isViewMode = arg.isViewMode;
                $scope.sectionCompletedCount = 0;

                if(!$scope.isViewMode){
                    $rootScope.$emit('answersFilled', {
                        inspectionId: $scope.inspection.Id
                    });
                }
            });

            $rootScope.$on('downloadChecklist', function (event, arg) {
                $scope.downloadBookmark(arg.type, arg.version);
            });

            $rootScope.$on('updateChecklistVersion', function (event, arg) {
                $scope.checklistVersion = arg.checklistVersion;
                $.each(arg.checklistVersion, function (index, checklist) {
                    $scope.downloadBookmark(checklist.BGCK__Object_Value__c, checklist.BGCK__Current_Version__c);
                });
            });

            $rootScope.$on('sectionCompleted', function (event, arg) {
                if (window.isDebugMode) {
                    console.log('sectionCompleted event= finding bookmark for ' + arg.pageId);
                }
                $.each($scope.bookmarks, function (index, bookmark) {
                    if (bookmark.Id == arg.pageId && bookmark.completed != true) {
                        if (window.isDebugMode) {
                            console.log('sectionCompleted event= found bookmark for ' + bookmark.Id);
                        }
                        bookmark.completed = true;
                        if (!$scope.$$phase) {
                            $scope.$apply();
                        }
                        $scope.sectionCompletedCount++;

                        if (window.isDebugMode) {
                            console.log('sectionCompleted event= bookmark icon updated section $scope.sectionCompletedCount = ' + $scope.sectionCompletedCount);
                        }
                        return false;
                    }
                });

                // Check if all questions are answered
                if ($scope.sectionCompletedCount == $scope.bookmarks.length) {
                    $rootScope.$emit('checklistCompleted');
                }
            });

            $scope.goToSection = function (event, pageId) {
                var bookmarkItems = $('#bookmarks-collapse-container').find('li');
                var bookmarkItemsExpand = $('#bookmarks-expand-container').find('li');

                // Set/remove active class
                bookmarkItems.removeClass('active');
                bookmarkItemsExpand.removeClass('active');
                bookmarkItems.filter('[data-pageid=' + pageId + ']').addClass('active');
                bookmarkItemsExpand.filter('[data-pageid=' + pageId + ']').addClass('active');

                // Scroll to selected page
                $(document).scrollTop($('#question-list-table').find('tr[data-pageid=' + pageId + ']')[0].offsetTop);
            }
        }
    };
});