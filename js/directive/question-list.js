/**
 * This directive will create a question list with 4 choices of answers for each question.
 *
 * @author      Pan Khantidhara
 * @version     1.0.0
 * @since       2014-01-23
 *
 * Library dependencies
 ** JQM 1.4.0
 ** sForce Ajax Toolkit 2.9
 ** AngularJS 1.2.7
 *
 * Code dependencies
 ** /html/partial/question-list.html
 ** /html/partial/question-extras.html
 ** /css/partial/question-list.less
 *
 * Configurations
 ** (r) sfOauthToken - sForce access token
 ** (r) orgUrl - sForce org URL
 ** (r) db - Database connection
 ** (o) pageTransition - JQM page transition style, defaulted to 'slide'.
 ** (o) questionQuery - SOQL for retrieveing question list
 ** (o) isDebugMode - Turn on/off debug mode
 **
 * Attributes for <questionextras>
 ** (o) questionextraspageid - DOM id of JQM container page, which contains <questionextras>.
        This value is used to display question extras page. The default is 'question-extra-page'.
 **
 * Attributes for <questionlist>
 ** (r) locationtype - The type of location(plant) that the questions are for. This value is used
 **     in a query to retrieve questions, if questionQuery wasn't specified by config.
 **
 **/

angular.module('questionListDirective', [/*'ngSanitize'*/]).

directive('questionextras', function ($rootScope) {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/question-extras.html',
        link: function (scope, element, attr) {
        },
        controller: function ($scope, $attrs) {
            var questionExtrasPageId = $attrs.questionextraspageid ? $attrs.questionextraspageid : 'question-extra-page';
            $scope.pageTransition = window.pageTransition ? window.pageTransition : 'slide';

            //Change to question extras page and fill it out using question object in the parameter
            $rootScope.$on('questionExtrasClick', function (event, question) {
                $scope.question = question;
                $.mobile.pageContainer.pagecontainer('change', '#' + questionExtrasPageId, {
                    transition: $scope.pageTransition
                });
            });

            $scope.goBackToChecklist = function () {
                $rootScope.$emit('goToQuestionOnChecklist', {
                    question: $scope.question
                });
            };

            $scope.goToSummaryScreen = function () {
                $rootScope.$emit('goToSummaryScreen');
            };

            //$scope.addNotes = function ($event) {
            //    $rootScope.$emit('addNotes', {
            //        question: $scope.question,
            //        questiontitle: $scope.question.title,
            //        $event: $event
            //    });
            //};
        }
    };
}).

directive('questionlist', function () {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/question-list.html',
        link: function (scope, element, attr) {
        },
        scope: {
            locationtype: '@'
        },
        controller: function ($scope, $element, $sce, $timeout, $attrs, $rootScope) {

            $scope.questionCountPerPage = null;
            $scope.questionPages = [];
            $scope.isViewMode = false;
            $scope.isReinspection = false;
            $scope.isResume = false;

            $scope.inspectionId = null;
            $scope.trustAsHtml = $sce.trustAsHtml;

            $scope.question = {
                choices: {
                    value: ''
                }
            };

            // Checklist validation
            $scope.validatePageChecklist = function (pageId) {
                // Check if this section is completed
                var sectionCompleted = true;
                $timeout(function () {
                    if (window.isDebugMode) {
                        console.log('$scope.validatePageChecklist= starting validation section ' + pageId);
                    }
                    $('#question-container tr[data-pageid=' + pageId + ']').each(function (index, element) {
//                        console.log($(element).find('input[type=hidden]')[0]);
                        if (!$(element).find('input')[0].validity.valid && $(element).find('input[type=hidden]').val() == 'false') { // Found one question that's incompleted
                            sectionCompleted = false;
                            if (window.isDebugMode) {
                                console.log('$scope.validatePageChecklist= section incompleted');
                            }
                            return false;
                        }
                    });

                    if (sectionCompleted) {
                        if (window.isDebugMode) {
                            console.log('$scope.validatePageChecklist= section completed');
                        }
                        $rootScope.$emit('sectionCompleted', {
                            pageId: pageId
                        });
                    }
                }, 0);
            };

            // Save an answer to a question on local database
            $scope.saveLocally = function (question, answer, comments) {
                var oldAnswer = null;

                //Count and group the number of questions, used for section validation
                //if (!$scope.questionCountPerPage) {
                //    $scope.questionCountPerPage = [];
                //    $('#question-container tr[data-pageid]').each(function (index, element) {
                //        var pageId = $(element).data('pageid');
                //        if ($scope.questionCountPerPage.hasOwnProperty(pageId)) {
                //            $scope.questionCountPerPage[pageId] += 1;
                //        }
                //        else {
                //            $scope.questionCountPerPage[pageId] = 1;
                //        }
                //    });
                //    console.log($scope.questionCountPerPage);
                //}

                function answerSelected() {

                    // Close note input popup if it was the comments that got saved
                    if (comments != null) {
                        $('#note-popup').popup('close');
                    }

                    // Count for CAN/IAR if it's answer selection
                    if (answer) {
                        switch (answer.label) {
                            case 'Unsatisfactory':
                            case 'Fail':
                                $scope.unsatCount++;
                                break;
                        }

                        $rootScope.$emit('answerSelected', {
                            unsatCount: $scope.unsatCount
                        });
                    }

                    $scope.validatePageChecklist(question.pageId);
                };

                function updateAnswer() {
                    // Count for CAN/IAR if it's answer selection
                    if (answer) {
                        switch (oldAnswer) {
                            case 'Unsatisfactory':
                            case 'Fail':
                                $scope.unsatCount--;
                                break;
                        }
                    }

                    answerSelected();
                };

                
                if (window.useIndexedDb) {
                    var tx = window.db.transaction("Answer", "readwrite");
                    var store = tx.objectStore("Answer");

                    store.get($scope.inspectionId + question.id).onsuccess = function (event) {
                        var dbAnswer = event.target.result;
                        var isNew = true;
                        if (dbAnswer) { // Answer exists
                            isNew = false;
                            oldAnswer = dbAnswer.Response;
                        } else {
                            dbAnswer = {};
                            dbAnswer.inspectionQuestionId = $scope.inspectionId + question.id;
                            dbAnswer.QuestionId = question.id;
                            dbAnswer.InspectionId = $scope.inspectionId;
                        }
                        if (answer) {
                            dbAnswer.Response = answer.label;
                        }
                        if (comments != null) {
                            dbAnswer.Comments = comments;
                        }

                        store.put(dbAnswer).onsuccess = function (event) {
                            if (isNew) {
                                answerSelected();
                            } else {
                                updateAnswer();
                            }
                        };
                    };
                } else {
                    // First check if an answer exists for this question.
                    db.transaction(function (tx) {
                        tx.executeSql("\
                            SELECT * FROM Answer\
                            WHERE QuestionId = '" + question.id + "' AND InspectionId = '" + $scope.inspectionId + "'\
                        ",
                        [],

                        // Success
                        function (tx, results) {
                            // Insert the new record into the database.
                            if (results.rows.length == 0) {
                                db.transaction(function (tx) {
                                    if (answer) {
                                        tx.executeSql("INSERT INTO Answer (QuestionId,InspectionId,Response) VALUES ('" + question.id + "','" + $scope.inspectionId + "','" + answer.label + "')");
                                    }
                                    if (comments != null) {
                                        tx.executeSql("INSERT INTO Answer (QuestionId,InspectionId,Comments) VALUES ('" + question.id + "','" + $scope.inspectionId + "','" + comments + "')");
                                    }
                                }, function (error) {
                                    console.error('questionlist.saveLocally insert error=' + JSON.stringify(error));
                                }, answerSelected);
                            } else {
                                oldAnswer = results.rows.item(0).Response;
                                // Or update the existing answer.
                                db.transaction(function (tx) {
                                    if (answer) {
                                        tx.executeSql("UPDATE Answer SET Response = '" + answer.label + "' WHERE QuestionId = '" + question.id + "' AND InspectionId = '" + $scope.inspectionId + "'");
                                    }
                                    if (comments != null) {
                                        tx.executeSql("UPDATE Answer SET Comments = ? WHERE QuestionId = '" + question.id + "' AND InspectionId = '" + $scope.inspectionId + "'", [comments]);
                                    }

                                }, function (error) {
                                    console.log('questionlist.saveLocally update error=' + JSON.stringify(error));
                                }, updateAnswer);
                            }
                        },

                        // Error
                        function (error) {
                            console.log('loadExistingAnswer select error: ' + JSON.stringify(error));
                        }
                    )
                    }, function (error) {
                        // Transaction error
                        console.log('loadExistingAnswer transaction error: ' + JSON.stringify(error));
                    });
                }
            };

            // Display question list
            $scope.getQuestions = function (locationType, version) {
                window.showLoadingMask('<h2>Inspection Loading...</h2><p>Your inspection is loading.</p>');
                $scope.isReinspection = $scope.$parent.isReinspection;
                $scope.isResume = $scope.$parent.isResume;

                $scope.questions = JSON.parse(localStorage.getItem(locationType + "Questions" + version));
                if (isDebugMode) {
                    navigator.notification.alert(localStorage.getItem(locationType + "Questions" + version), null, locationType + 'Questions');
                }
                $scope.$parent.questions = $scope.questions;

                // Get answers if this is a reinspection
                if ($scope.$parent.isReinspection || $scope.$parent.isResume) {
                    $scope.getInspectionAnswersLocally();
                }

                $timeout(function () {
                    $($element).trigger('create'); //Calls jQuery to re-render
                    window.hideLoadingMask();
                }, 0);
            };

            // Sync down questions from SF and store it in local storage
            $scope.downloadQuestions = function (locationType, version) {
                if (!localStorage.getItem(locationType + "Questions" + version)) {
                    window.showLoadingMask('<h2>Starting Application...</h2><p>The application is loading.</p>');
                    var pages = JSON.parse(localStorage.getItem(locationType + "Bookmark" + version));

                    var downloadPageIds = '';
                    for (var i = 0; i < pages.length; i++) {
                        downloadPageIds += "'" + pages[i].Id + "'";
                        if (i != pages.length - 1) {
                            downloadPageIds += ',';
                        }
                    }

                    var questionQuery = window.questionQuery ? window.questionQuery : "SELECT BGCK__Page__c, BGCK__Question__r.Id, BGCK__Question__r.Name, BGCK__Question__r.BGCK__Question_Number__c, BGCK__Question__r.BGCK__Body__c, BGCK__Question__r.BGCK__isOptional__c, BGCK__Question__r.BGCK__Criteria__c, BGCK__Question__r.BGCK__Tip__c, BGCK__Question__r.BGCK__Question_Type__r.Id FROM BGCK__Page_Question__c WHERE BGCK__Page__r.Id IN (" + downloadPageIds + ") AND BGCK__Page__r.BGCK__Object_Value__c = '" + locationType + "' ORDER BY BGCK__Page__r.BGCK__Order__c, BGCK__Order__c";
                    if (window.isDebugMode) {
                        console.log('questionList controller sforce query= ' + questionQuery);
                    }

                    sforce.connection.query(questionQuery, {
                        onSuccess: function (result) {
                            if (window.isDebugMode) {
                                console.log('questionList controller sforce questionQuery result= ' + JSON.stringify(result));
                                console.log('questionList controller sforce questionQuery result size= ' + result.size);
                            }

                            //Make question list JS array cleaner and retrieve available answer choices
                            $scope.questions = [];
                            var questionTypeIds = [];
                            var questionTypeIdString = "";

                            //Put id of question type into an array, and remove duplicate values
                            $.each(result.getArray('records'), function (index, question) {
                                var id = question.BGCK__Question__r.BGCK__Question_Type__r.Id;
                                var found = $.inArray(id, questionTypeIds);
                                if (found < 0) {
                                    questionTypeIds.push(id);
                                }
                            });

                            //Make the id array a string for query
                            $.each(questionTypeIds, function (index, id) {
                                questionTypeIdString = questionTypeIdString.concat("'" + id + "'");
                                if (index != questionTypeIds.length - 1) {
                                    questionTypeIdString = questionTypeIdString.concat(', ');
                                }
                            });

                            //Get answer choices
                            var answerQuery = "SELECT Id, Name, (SELECT Name, BGCK__Answer_Type__r.Name FROM BGCK__Choices__r ORDER BY BGCK__Answer_Type__r.BGCK__Order__c) FROM BGCK__Question_Type__c WHERE Id IN (" + questionTypeIdString + ")";
                            var questionTypes = sforce.connection.query(answerQuery);

                            if (window.isDebugMode) {
                                console.log('questionList controller sforce answerQuery result= ' + JSON.stringify(questionTypes));
                                console.log('questionList controller sforce answerQuery result size= ' + questionTypes.size);
                            }

                            //Make returned answer choices simple array
                            var answers = [];
                            $.each(questionTypes.getArray('records'), function (index, questionType) {
                                var answerChoices = [];
                                $.each(questionType.BGCK__Choices__r.records, function (index, choice) {
                                    answerChoices.push({
                                        name: choice.Name,
                                        label: choice.BGCK__Answer_Type__r.Name
                                    });
                                });
                                answers.push({
                                    id: questionType.Id,
                                    choices: answerChoices
                                });
                            });

                            //Map answer to questions, and store it on memory($scope.questions)
                            $.each(result.getArray('records'), function (index, question) {
                                $.each(answers, function (index, answer) {
                                    if (question.BGCK__Question__r.BGCK__Question_Type__r.Id == answer.id) {
                                        $scope.questions.push({
                                            id: question.BGCK__Question__r.Id,
                                            pageId: question.BGCK__Page__c,
                                            title: question.BGCK__Question__r.Name,
                                            number: question.BGCK__Question__r.BGCK__Question_Number__c,
                                            body: question.BGCK__Question__r.BGCK__Body__c,
                                            isOptional: question.BGCK__Question__r.BGCK__isOptional__c,
                                            procedure: question.BGCK__Question__r.BGCK__Criteria__c,
                                            verification: question.BGCK__Question__r.BGCK__Tip__c,
                                            answer: answer
                                        });
                                        return false;
                                    }
                                });
                            });

                            //$scope.$parent.questions = $scope.questions;

                            //Store question in local storage
                            localStorage.setItem(locationType + "Questions" + version, JSON.stringify($scope.questions));
                            if (window.isDebugMode) {
                                console.log('questionList controller locally stored questions for ' + locationType + '= ' + JSON.stringify(questionTypes));
                            }
                            $scope.questions = [];
                            window.hideLoadingMask();
                        },
                        onFailure: function (error) {
//                            navigator.notification.alert('Failed to download questions for ' + locationType + ' version ' + version, null, 'Checklist download failed');
                            console.log('Failed to download questions for ' + locationType + ' version ' + version);
                            window.hideLoadingMask();
                        }
                    });
                } else {
                    window.hideLoadingMask();
                }
            };

            $scope.getInspectionAnswersLocally = function () {
                $scope.inspectionAnswers = [];

                if (window.useIndexedDb) {
                    var tx = window.db.transaction("Answer", "readwrite");
                    var store = tx.objectStore("Answer");
                    var index = store.index("by_InspectionId");

                    // Retrieve answers from db
                    index.openCursor(IDBKeyRange.only($scope.inspectionId)).onsuccess = function (event) {
                        var answerCursor = event.target.result;
                        var answerItem;

                        if (answerCursor) {
                            answerItem = angular.copy(answerCursor.value);
                            $scope.inspectionAnswers.push(answerItem);
                            answerCursor.continue();
                        } else { // Done
                            $.each($scope.questions, function (index, question) {
                                var answerForThisQuestion = $.grep($scope.inspectionAnswers, function (answer, index) {
                                    return answer.QuestionId == question.id;
                                })[0];
                                question.thisAnswer = answerForThisQuestion;

                                switch (answerForThisQuestion.Response) {
                                    case 'Unsatisfactory':
                                    case 'Fail':
                                        $scope.$parent.unsatCount++;
                                        $scope.unsatCount++;
                                        break;
                                }
                            });

                            if (!$scope.$$phase) {
                                $scope.$apply();
                            }

                            $rootScope.$emit('answersFilled', {
                                inspectionId: $scope.inspectionId
                            });

                            $timeout(function () {
                                $($element).trigger('create'); //Calls jQuery to re-render
                            }, 0);
                        }
                    };
                } else {
                    // Retrieve answers from db
                    db.transaction(function (tx) {
                        tx.executeSql("SELECT * FROM Answer WHERE InspectionId = '" + $scope.inspectionId + "'",
                        [],

                        // Success
                        function (tx, results) {
                            if (results.rows.length > 0) {
                                for (var i = 0; i < results.rows.length; i++) {
                                    $scope.inspectionAnswers.push(results.rows.item(i));
                                }
                                $.each($scope.questions, function (index, question) {
                                    var answerForThisQuestion = $.grep($scope.inspectionAnswers, function (answer, index) {
                                        return answer.QuestionId == question.id;
                                    })[0];
                                    if (answerForThisQuestion) {
                                        question.thisAnswer = answerForThisQuestion;

                                        switch (answerForThisQuestion.Response) {
                                            case 'Unsatisfactory':
                                            case 'Fail':
                                                $scope.$parent.unsatCount++;
                                                $scope.unsatCount++;
                                                break;
                                        }
                                    }
                                });

                                if (!$scope.$$phase) {
                                    $scope.$apply();
                                }
                            }

                            $rootScope.$emit('answersFilled', {
                                inspectionId: $scope.inspectionId
                            });

                            $timeout(function () {
                                $($element).trigger('create'); //Calls jQuery to re-render
                            }, 0);
                        },

                        // Error
                        function (error) {
                            console.error('getInspectionAnswersLocally select error: ' + JSON.stringify(error));
                        }
                    )
                    }, function (error) {
                        // Transaction error
                        console.error('getInspectionAnswersLocally transaction error: ' + JSON.stringify(error));
                    });
                }
            };

            $rootScope.$on('startInspection', function (event, arg) {
                $scope.isViewMode = arg.isViewMode;
                $scope.inspectiontype = arg.type;
                $scope.inspectionId = arg.id;
                $scope.getQuestions(arg.type, arg.inspection.ChecklistVersion);

                $scope.unsatCount = 0;
            });

            $rootScope.$on('updateQuestionsVersion', function (event, arg) {
                $scope.downloadQuestions(arg.locationType, arg.version);
            });

            // Make section scrolls with bookmark
            var lastPageId;
            $('#question-container').on('vmousemove', function () {
                var bookmarkItems = $('#bookmarks-collapse-container').find('li');
                var bookmarkItemsExpand = $('#bookmarks-expand-container').find('li');
                var questionItems = $('#question-list-table').find('tr[data-pageid]');

                // Get container scroll position
                var fromTop = $(document).scrollTop() + 70;

                // Get id of current scroll item
                var cur;
                $.each(questionItems, function (index, questionItem) {
                    if ($(this).offset().top > fromTop) {
                        cur = $(questionItem);
                        return false;
                    }

                });

                // Get the id of the current element
                var pageId = cur ? cur.data('pageid') : '';
                $scope.currentQuestionId = cur ? cur.data('questionid') : '';

                if (lastPageId !== pageId) {
                    lastPageId = pageId;
                    // Set/remove active class
                    bookmarkItems.removeClass('active');
                    bookmarkItemsExpand.removeClass('active');
                    bookmarkItems.filter('[data-pageid=' + pageId + ']').addClass('active');
                    bookmarkItemsExpand.filter('[data-pageid=' + pageId + ']').addClass('active');
                }
            });

            $rootScope.$on('addNotes', function (event, arg) {
                $scope.addNotes(arg.question, arg.questiontitle, arg.$event);
            });

            // Handler when a user clicks on Notes button
            $scope.addNotes = function (question, questiontitle, $event) {
                $('#note-popup').popup('open', {
                    positionTo: 'window'
                });

                if (window.useIndexedDb) {
                    // First check if an answer exists for this question.
                    var tx = window.db.transaction("Answer", "readwrite");
                    var store = tx.objectStore("Answer");

                    store.get($scope.inspectionId + question.id).onsuccess = function (event) {
                        var dbAnswer = event.target.result;

                        // Set the notes
                        var notes = (dbAnswer && dbAnswer.Comments) ? dbAnswer.Comments : '';

                        $rootScope.$emit('addNote', {
                            saveObject: question,
                            title: 'Comments for "' + questiontitle + '"',
                            notes: notes,
                            cbFn: function (arg) {
                                $scope.saveLocally(arg.saveObject, null, arg.notes);
                                if (arg.notes.length > 0) { // Has note
                                    $($event.target).addClass('has-note');
                                } else { // No note
                                    $($event.target).removeClass('has-note');
                                }

                            }
                        });
                    };
                } else {
                    // First check if an answer exists for this question.
                    db.transaction(function (tx) {
                        tx.executeSql("\
				            SELECT * FROM Answer\
				            WHERE QuestionId = '" + question.id + "' AND InspectionId = '" + $scope.inspectionId + "'\
			            ",
                        [],

                        // Success
                        function (tx, results) {
                            var notes = '';
                            // Set the notes
                            if (results.rows.length > 0) {
                                notes = results.rows.item(0).Comments;
                            }

                            $rootScope.$emit('addNote', {
                                saveObject: question,
                                title: 'Comments for "' + questiontitle + '"',
                                notes: notes,
                                cbFn: function (arg) {
                                    $scope.saveLocally(arg.saveObject, null, arg.notes);
                                    if (arg.notes.length > 0) { // Has note
                                        $($event.target).addClass('has-note');
                                    } else { // No note
                                        $($event.target).removeClass('has-note');
                                    }

                                }
                            });
                        },

                        // Error
                        function (error) {
                            console.log('addNotes select error: ' + JSON.stringify(error));
                        }
                    )
                    }, function (error) {
                        // Transaction error
                        console.log('addNotes transaction error: ' + JSON.stringify(error));
                    });
                }
            };

            $rootScope.$on('goToQuestionOnChecklist', function (event, arg) {
                if (arg.question) { // Scroll to selected question or scroll to the last question the user was looking at
                    $scope.currentQuestionId = arg.question.id;
                }

                if (arg.inspection) { // Set inspection info if there's one
                    $scope.$parent.inspection = arg.inspection;
                }

                if($scope.currentQuestionId){
                    $(':mobile-pagecontainer').on('pagecontainershow', function (event, ui) {
                        $(document).scrollTop($('#question-list-table').find('tr[data-questionid=' + $scope.currentQuestionId + ']')[0].offsetTop);
                        $(':mobile-pagecontainer').off('pagecontainershow');
                        $('#question-container').trigger('scrollstop');
                    });
                }

                $.mobile.pageContainer.pagecontainer('change', '#main-checklist-page', {
                    transition: 'slide',
                    reverse: true
                });
            });
        }
    };
});
