tgapApp.controller('MainChecklistPageCtrl', ['$scope', '$element', '$timeout', '$rootScope', function ($scope, $element, $timeout, $rootScope) {
    $scope.isViewMode = false;
    $scope.isReinspection = false;
    $scope.isResume = false;

    $rootScope.$on('startInspection', function (event, arg) {
        window.showLoadingMask("<h2>Inspection Loading...</h2><p>Your inspection is loading.</p>");
        $scope.inspection = arg.inspection;
        $scope.isViewMode = arg.isViewMode;
        $scope.isReinspection = $scope.inspection.PreviousInspection ? true : false;
        $scope.inspection.isReinspection = $scope.isReinspection;
        $scope.isResume = arg.isResume;

        $scope.isChecklistCompleted = false;
        $scope.isChecklistStarted = false;
        $scope.unsatCount = 0;

        $.mobile.pageContainer.pagecontainer('change', '#main-checklist-page', {
            transition: 'slide'
        });
        if (!$scope.$$phase) {
            $scope.$apply();
        }

        window.hideLoadingMask();
    });

    $rootScope.$on('goToSummaryScreen', function () {
        $scope.goToSummaryScreen($scope.isChecklistCompleted);
    });

//    $rootScope.$on('answersFilled', function () {
//        if (!$scope.isChecklistCompleted) {
//            $scope.isChecklistCompleted = true;
//        }
//    });

    $scope.goToSummaryScreen = function (completed) {
        window.showLoadingMask('<h2>Summary Loading...</h2><p>Your summary is loading.</p>');
        $rootScope.$emit('showSummaryPage', {
            inspection: $scope.inspection,
            questions: $scope.questions,
            isCompleted: completed,
            isViewMode: false
        });
        window.hideLoadingMask();
    };

    $rootScope.$on('checklistCompleted', function () {
        $scope.isChecklistCompleted = true;
        $timeout(function () {
            $($element).trigger('create'); //Calls jQuery to re-render
        }, 0);
    });

    $rootScope.$on('answerSelected', function (event, arg) {
        $scope.unsatCount = arg.unsatCount;
        if (!$scope.isChecklistStarted) {
            $scope.isChecklistStarted = true;

            // Set start time
            if (!$scope.isResume) {
                if (window.useIndexedDb) {
                    //Update start time on the record
                    var tx = window.db.transaction("Inspection", "readwrite");
                    var store = tx.objectStore("Inspection");

                    store.get($scope.inspection.Id).onsuccess = function (event) {
                        var dbInspection = event.target.result;
                        $scope.inspection.StartTime = dbInspection.StartTime = moment().format(window.timeFormat);

                        store.put(dbInspection).onsuccess = function (event) {
                            if (window.isDebugMode) {
                                console.log('startInspection update error=' + JSON.stringify(event.target));
                            }

                            // Success
                        };
                    };
                } else {
                    //Update start time on the record
                    db.transaction(function (tx) {
                        $scope.inspection.StartTime = moment().format(window.timeFormat);
                        tx.executeSql("UPDATE Inspection SET StartTime = '" + $scope.inspection.StartTime + "' WHERE Id = '" + $scope.inspection.Id + "'");
                    }, function (error) {
                        console.log('startInspection update error=' + JSON.stringify(error));
                    }, function () {
                        // Success
                    });
                }
            }
        }
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    });

    $rootScope.$on('addInspectionNotes', function (event, arg) {
        $scope.addInspectionNotes(arg.inspection, arg.$event);
    });

    // Handler when a user clicks on Notes button
    $scope.addInspectionNotes = function (inspection, $event) {
        $('#note-popup').popup('open', {
            positionTo: 'window'
        });

        if (window.useIndexedDb) {
            var tx = window.db.transaction("Inspection", "readwrite");
            var store = tx.objectStore("Inspection");

            store.get(inspection.Id).onsuccess = function (event) {
                var dbInspection = event.target.result;

                // Set the notes
                var notes = dbInspection.Notes;

                $rootScope.$emit('addNote', {
                    saveObject: inspection,
                    title: 'Comments for Audit #' + inspection.AuditName + ', Inspection #' + inspection.Name,
                    notes: notes,
                    cbFn: function (arg) {
                        var tx = window.db.transaction("Inspection", "readwrite");
                        var store = tx.objectStore("Inspection");

                        store.get(inspection.Id).onsuccess = function (event) {
                            var dbInspection = event.target.result;

                            //Update the notes on the record
                            dbInspection.Notes = arg.notes;

                            store.put(dbInspection).onsuccess = function (event) {
                                var inspectionWithNewNote = angular.copy($scope.inspection);
                                inspectionWithNewNote.Notes = arg.notes;
                                $scope.inspection = inspectionWithNewNote;
                                $('#note-popup').popup('close');
                                var jTarget = $($event.target);
                                if (arg.notes.length > 0) { // Has note
                                    if (jTarget.is('button')) {
                                        jTarget.find('span.ui-icon-note').addClass('has-note');
                                    } else if (jTarget.is('span.ui-icon-note')) {
                                        jTarget.addClass('has-note');
                                    }else if (jTarget.is('span')) {
                                        jTarget.parent('button').find('span.ui-icon-note').addClass('has-note');
                                    }
                                } else { // No note
                                    if (jTarget.is('button')) {
                                        jTarget.find('span.ui-icon-note').removeClass('has-note');
                                    } else if (jTarget.is('span.ui-icon-note')) {
                                        jTarget.removeClass('has-note');
                                    } else if (jTarget.is('span')) {
                                        jTarget.parent('button').find('span.ui-icon-note').removeClass('has-note');
                                    }
                                }
                            };
                        };
                    }
                });
            };
        } else {
            // First check if an answer exists for this question.
            db.transaction(function (tx) {
                tx.executeSql("SELECT * FROM Inspection WHERE Id = '" + inspection.Id + "'",
                [],

                // Success
                function (tx, results) {
                    // Set the notes
                    var notes = results.rows.item(0).Notes;

                    $rootScope.$emit('addNote', {
                        saveObject: inspection,
                        title: 'Comments for  Inspection #' + inspection.Name,
                        notes: notes,
                        cbFn: function (arg) {
                            //Update the notes on the record
                            db.transaction(function (tx) {
                                tx.executeSql("UPDATE Inspection SET Notes = ? WHERE Id = '" + inspection.Id + "'", [arg.notes]);
                            }, function (error) {
                                console.log('addInspectionNotes update error=' + JSON.stringify(error));
                            }, function () {
                                $scope.inspection.Notes = arg.notes;
                                var jTarget = $($event.target);
                                $('#note-popup').popup('close');
                                if (arg.notes.length > 0) { // Has note
                                    if (jTarget.is('button')) {
                                        jTarget.find('span.ui-icon-note').addClass('has-note');
                                    } else if (jTarget.is('span.ui-icon-note')) {
                                        jTarget.addClass('has-note');
                                    } else if (jTarget.is('span')) {
                                        jTarget.parent('button').find('span.ui-icon-note').addClass('has-note');
                                    }
                                } else { // No note
                                    if (jTarget.is('button')) {
                                        jTarget.find('span.ui-icon-note').removeClass('has-note');
                                    } else if (jTarget.is('span.ui-icon-note')) {
                                        jTarget.removeClass('has-note');
                                    } else if (jTarget.is('span')) {
                                        jTarget.parent('button').find('span.ui-icon-note').removeClass('has-note');
                                    }
                                }
                            });
                        }
                    });
                },

                // Error
                function (error) {
                    console.log('addInspectionNotes select error: ' + JSON.stringify(error));
                }
            )
            }, function (error) {
                // Transaction error
                console.log('addInspectionNotes transaction error: ' + JSON.stringify(error));
            });
        }
    };

    $scope.goToInspectionList = function(){
        $.mobile.pageContainer.pagecontainer('change', '#inspection-list-page', {
            transition: 'slide',
            direction: 'reverse'
        });
        $rootScope.$emit('completedInspection', {
            inspection: $scope.inspection
        });
    }
}]);