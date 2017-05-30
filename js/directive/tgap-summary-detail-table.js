/**
 * This directive will create a table which list all CAN and IAR questions, and question with notes.
 * This will also allow the user to enter corrective action.
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

angular.module('tgapSummaryDetailTableDirective', []).

directive('tgapsummarydetailtable', function () {
    return {
        restrict: 'AE',
        templateUrl: 'html/partial/tgap-summary-detail-table.html',
        scope: {
        },
        link: function (scope, element, attr) {
        },
        controller: function ($scope, $rootScope) {
            $scope.getUnsatAnswers = function () {
                window.showLoadingMask('<h2>Summary Loading...</h2><p>Your summary is loading.</p>');
                $scope.unsatAnswers = [];

                if (window.useIndexedDb) {
                    //Retrieve answers with IAR/CAN
                    var tx = window.db.transaction("Answer", "readwrite");
                    var store = tx.objectStore("Answer");
                    var index = store.index("by_ResponseAndInspectionId");

                    $scope.$parent.unsatCount = 0;

                    var getQueryResults = function (event, container) {
                        var answerCursor = event.target.result;
                        var answer;

                        if (answerCursor) {
                            answer = angular.copy(answerCursor.value);

                            switch (answer.Response) {
                                case 'Unsatisfactory':
                                case 'Fail':
                                    $scope.$parent.unsatCount++;
                                    break;
                            }

                            answer.question = $.grep($scope.$parent.questions, function (question, index) {
                                return question.id == answer.QuestionId;
                            })[0];
                            container.push(answer);

                            answerCursor.continue();
                        } else { // Done
                            if (!$scope.$$phase) {
                                $scope.$apply();
                            }
                            window.hideLoadingMask();
                        }
                    };

                    index.openCursor(IDBKeyRange.only(['IAR', $scope.$parent.inspection.Id])).onsuccess = function (event) {
                        getQueryResults(event, $scope.unsatAnswers);
                    };

                    index.openCursor(IDBKeyRange.only(['CAN', $scope.$parent.inspection.Id])).onsuccess = function (event) {
                        getQueryResults(event, $scope.unsatAnswers);
                    };
                } else {
                    //Retrieve answers with IAR/CAN
                    db.transaction(function (tx) {
                        tx.executeSql("\
				            SELECT * FROM Answer\
				            WHERE Response IN ('Unsatisfactory', 'Fail') AND InspectionId = '" + $scope.$parent.inspection.Id + "'\
			            ",
                        [],

                        // Success
                        function (tx, results) {
                            $scope.$parent.unsatCount = 0;
                            for (var i = 0; i < results.rows.length; i++) {
                                var answer = results.rows.item(i);

                                switch (answer.Response) {
                                    case 'Unsatisfactory':
                                    case 'Fail':
                                        $scope.$parent.unsatCount++;
                                        break;
                                }

                                answer.question = $.grep($scope.$parent.questions, function (question, index) {
                                    return question.id == answer.QuestionId;
                                })[0];
                                $scope.unsatAnswers.push(answer);
                            }

                            if (!$scope.$$phase) {
                                $scope.$apply();
                            }
                            window.hideLoadingMask();
                            //oldAnswer = results.rows.item(0).Response;
                        },

                        // Error
                        function (error) {
                            console.log('load IAR/CAN answers select error: ' + JSON.stringify(error));
                        }
                    )
                    }, function (error) {
                        // Transaction error
                        console.log('load IAR/CAN answers transaction error: ' + JSON.stringify(error));
                    });
                }
            };

            $scope.getNoteAnswers = function () {
                window.showLoadingMask('<h2>Summary Loading...</h2><p>Your summary is loading.</p>');
                $scope.noteAnswers = [];

                if (window.useIndexedDb) {
                    //Retrieve answers with notes
                    var tx = window.db.transaction("Answer", "readwrite");
                    var store = tx.objectStore("Answer");
                    var index = store.index("by_ResponseAndInspectionId");

                    var getQueryResults = function (event, container) {
                        var answerCursor = event.target.result;
                        var answer;

                        if (answerCursor) {
                            answer = angular.copy(answerCursor.value);
                            if (answer.Comments) {
                                answer.question = $.grep($scope.$parent.questions, function (question, index) {
                                    return question.id == answer.QuestionId;
                                })[0];
                                container.push(answer);
                            }

                            answerCursor.continue();
                        } else { // Done
                            if (!$scope.$$phase) {
                                $scope.$apply();
                            }
                            window.hideLoadingMask();
                        }
                    };

                    index.openCursor(IDBKeyRange.only(['C', $scope.$parent.inspection.Id])).onsuccess = function (event) {
                        getQueryResults(event, $scope.noteAnswers);
                    };

                    index.openCursor(IDBKeyRange.only(['N/A', $scope.$parent.inspection.Id])).onsuccess = function (event) {
                        getQueryResults(event, $scope.noteAnswers);
                    };
                } else {
                    //Retrieve answers with notes
                    db.transaction(function (tx) {
                        tx.executeSql("\
				            SELECT * FROM Answer\
				            WHERE Comments IS NOT NULL AND Comments != '' AND Response NOT IN ('Fail') AND InspectionId = '" + $scope.$parent.inspection.Id + "'\
			            ",
                        [],

                        // Success
                        function (tx, results) {
                            for (var i = 0; i < results.rows.length; i++) {
                                var answer = results.rows.item(i);
                                answer.question = $.grep($scope.$parent.questions, function (question, index) {
                                    return question.id == answer.QuestionId;
                                })[0];
                                $scope.noteAnswers.push(answer);
                            }

                            if (!$scope.$$phase) {
                                $scope.$apply();
                            }
                            window.hideLoadingMask();
                        },

                        // Error
                        function (error) {
                            console.log('load answers with notes select error: ' + JSON.stringify(error));
                        }
                    )
                    }, function (error) {
                        // Transaction error
                        console.log('load answers with notes transaction error: ' + JSON.stringify(error));
                    });
                }
            };

            $scope.getUnansweredAnswers = function () {
                window.showLoadingMask('<h2>Summary Loading...</h2><p>Your summary is loading.</p>');
                $scope.unansweredAnswers = [];

                if (window.useIndexedDb) {
                    //Retrieve answers without response
                    var tx = window.db.transaction("Answer", "readwrite");
                    var store = tx.objectStore("Answer");
                    var index = store.index("by_ResponseAndInspectionId");

                    var getQueryResults = function (event, container) {
                        var answerCursor = event.target.result;
                        var answer;

                        if (answerCursor) {
                            answer = angular.copy(answerCursor.value);
                            answer.question = $.grep($scope.$parent.questions, function (question, index) {
                                return question.id == answer.QuestionId;
                            })[0];
                            container.push(answer);

                            answerCursor.continue();
                        } else { // Done

                            if (!$scope.$$phase) {
                                $scope.$apply();
                            }
                            window.hideLoadingMask();
                        }
                    };

                    index.openCursor(IDBKeyRange.only(['', $scope.$parent.inspection.Id])).onsuccess = function (event) {
                        getQueryResults(event, $scope.unansweredAnswers);
                    };
                } else {
                    //Retrieve answers with IAR/CAN
                    db.transaction(function (tx) {
                        tx.executeSql("\
				            SELECT * FROM Answer\
				            WHERE Response IS NULL AND InspectionId = '" + $scope.$parent.inspection.Id + "'\
			            ",
                        [],

                        // Success
                        function (tx, results) {
                            for (var i = 0; i < results.rows.length; i++) {
                                var answer = results.rows.item(i);
                                answer.question = $.grep($scope.$parent.questions, function (question, index) {
                                    return question.id == answer.QuestionId;
                                })[0];
                                $scope.unansweredAnswers.push(answer);
                            }

                            if (!$scope.$$phase) {
                                $scope.$apply();
                            }
                            window.hideLoadingMask();
                        },

                        // Error
                        function (error) {
                            console.log('load unanswered answers select error: ' + JSON.stringify(error));
                        }
                    )
                    }, function (error) {
                        // Transaction error
                        console.log('load unanswered answers transaction error: ' + JSON.stringify(error));
                    });
                }
            };

            $rootScope.$on('showSummaryPage', function (event, arg) {
                $scope.isViewMode = $scope.$parent.isViewMode;
                $scope.getUnsatAnswers();
                $scope.getNoteAnswers();
                $scope.getUnansweredAnswers();
            });

            $scope.goToQuestion = function (question) {
                $rootScope.$emit('goToQuestionOnChecklist', {
                    question: question
                });
            };


            $scope.addCorrectiveAction = function (answer) {
                $('#note-popup').popup('open', {
                    positionTo: 'window'
                });

                if (window.useIndexedDb) {
                    // Retrieve the answer for this question.
                    var tx = window.db.transaction("Answer", "readwrite");
                    var store = tx.objectStore("Answer");

                    store.get($scope.$parent.inspection.Id + answer.question.id).onsuccess = function (event) {
                        var dbAnswer = event.target.result;

                        // Set the notes
                        var correctiveAction = (dbAnswer && dbAnswer.CorrectiveAction) ? dbAnswer.CorrectiveAction : '';

                        $rootScope.$emit('addNote', {
                            saveObject: dbAnswer,
                            title: 'Corrective Action for "' + answer.question.title + '"',
                            notes: correctiveAction,
                            cbFn: function (arg) {
                                //Update the notes on the record
                                var tx = window.db.transaction("Answer", "readwrite");
                                var store = tx.objectStore("Answer");

                                dbAnswer.CorrectiveAction = arg.notes;
                                store.put(dbAnswer).onsuccess = function (event) {
                                    $('#note-popup').popup('close');
                                    $scope.getUnsatAnswers();
                                };
                            }
                        });
                    };
                } else {
                    // Retrieve the answer for this question.
                    db.transaction(function (tx) {
                        tx.executeSql("SELECT * FROM Answer WHERE QuestionId = '" + answer.question.id + "' AND InspectionId = '" + $scope.$parent.inspection.Id + "'",
                        [],

                        // Success
                        function (tx, results) {
                            // Set the notes
                            var correctiveAction = results.rows.item(0).CorrectiveAction;

                            $rootScope.$emit('addNote', {
                                saveObject: results.rows.item(0),
                                title: 'Corrective Action for "' + answer.question.title + '"',
                                notes: correctiveAction,
                                cbFn: function (arg) {
                                    //Update the notes on the record
                                    db.transaction(function (tx) {
                                        tx.executeSql("UPDATE Answer SET CorrectiveAction = ? WHERE QuestionId = '" + answer.question.id + "' AND InspectionId = '" + $scope.$parent.inspection.Id + "'", [arg.notes]);
                                    }, function (error) {
                                        console.error('addCorrectiveAction update error=' + JSON.stringify(error));
                                    }, function () {
                                        $('#note-popup').popup('close');
                                        $scope.getUnsatAnswers();
                                    });
                                }
                            });
                        },

                        // Error
                        function (error) {
                            console.log('addCorrectiveAction select error: ' + JSON.stringify(error));
                        })
                    }, function (error) {
                        // Transaction error
                        console.log('addCorrectiveAction transaction error: ' + JSON.stringify(error));
                    });
                }
            };
        }
    };
});