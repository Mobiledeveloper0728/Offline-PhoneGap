tgapApp.controller('InspectionListCtrl', ['$scope', '$sce', '$element', '$timeout', '$rootScope', function ($scope, $sce, $element, $timeout, $rootScope) {
    if (navigator.connection.type != Connection.NONE) {
        $scope.isOnline = true;
    } else {
        $scope.isOnline = false;
    }

    document.addEventListener('online', function () {
        $scope.isOnline = true;
        if (window.isDebugMode) {
            navigator.notification.alert('--- ONLINE ---', '--- ONLINE ---');
        }
        $scope.$apply();
    }, false);

    document.addEventListener('offline', function () {
        $scope.isOnline = false;
        if (window.isDebugMode) {
            navigator.notification.alert('--- OFFLINE ---', '--- OFFLINE ---');
        }
        $scope.$apply();
    }, false);

    //Scope variables
    $scope.inspections = [];
    $scope.isUploading = false;
    $scope.trustAsHtml = $sce.trustAsHtml;

    // Save an array of inspections in local database
    $scope.saveLocally = function (inspections, notificationMsg, notificationTitle) {
        window.showLoadingMask('<h2>Syncing Data...</h2><p>Your data is being synced with the system.</p>');
        if (window.useIndexedDb) {
            var tx = window.db.transaction("Inspection", "readwrite");
            var store = tx.objectStore("Inspection");
            var inspectionsToBeSaved = [];

            // Filter out the inspections that don't exist.
            var i = 0;
            var saveNonExistedInspections = function () {
                if (i < inspections.length) {
                    store.get(inspections[i].Id).onsuccess = function (event) {
                        if (!event.target.result) { // Not found
                            inspectionsToBeSaved.push(inspections[i]);
                        }
                        i++;
                        saveNonExistedInspections();
                    }
                } else { // Completed
                    $.each(inspectionsToBeSaved, function (index, inspection) {
                        if (!inspection.ChecklistVersion) {
                            var foundChecklist = $.grep($scope.checklistVersion, function (version, index) {
                                return inspection.ChecklistType == version.BGCK__Object_Value__c;
                            })[0];

                            if (foundChecklist) {
                                inspection.ChecklistVersion = foundChecklist.BGCK__Current_Version__c;
                            } else {
//                                navigator.notification.alert('Checklist not found for inspection type ' + inspection.Type + '. Please double-check this inspection type in the system and try to download your inspections again.', null, 'Checklist download failed');
                                console.log('Checklist not found for inspection type ' + inspection.ChecklistType + '. Please double-check this inspection type in the system and try to download your inspections again.');
                                return true;
                            }

                        }

                        inspection.InspectorId = $scope.username;

                        if (inspection.PreviousInspection && inspection.PreviousInspection != '') {
                            $scope.downloadAnswers(inspection);
                        }
                    });

                    window.bulkDbInsert(inspectionsToBeSaved, store, function () {
                        $scope.getAllInspections(notificationMsg, notificationTitle);
                    });

                    window.hideLoadingMask();
                }
            };
            saveNonExistedInspections();
        } else {
            window.db.transaction(function (tx) {
                // Delete the unstarted inspections
                tx.executeSql("\
				    DELETE FROM Inspection\
				    WHERE StartTime IS NULL AND Status IS NULL\
			    ",
                [], function (tx, results) {// Success
                    // Check if this inspection exists.
                    $.each(inspections, function (index, inspection) {
                        tx.executeSql("\
				            SELECT * FROM Inspection\
				            WHERE Id = '" + inspection.Id + "'\
			            ",
                        [], function (tx, results) {// Success
                            // Insert the new record into the database if it didn't exist
                            if (results.rows.length == 0) {
                                var checklistVersion;
                                if (inspection.ChecklistVersion) {
                                    checklistVersion = inspection.ChecklistVersion;
                                } else {
                                    var foundChecklist = $.grep($scope.checklistVersion, function (version, index) {
                                        return inspection.ChecklistType == version.BGCK__Object_Value__c;
                                    })[0];

                                    if (foundChecklist) {
                                        checklistVersion = foundChecklist.BGCK__Current_Version__c;
                                    } else {
//                                        navigator.notification.alert('Checklist not found for inspection type of ' + inspection.Type + '. Please double-check this inspection type in the system and try to download your inspections again.', null, 'Checklist download failed');
                                        console.log('Checklist not found for inspection type of ' + inspection.ChecklistType + '. Please double-check this inspection type in the system and try to download your inspections again.');
//                                        return true;
                                    }
                                }

                                tx.executeSql("INSERT INTO Inspection (RecordType, Id, InspectorId, Name, ChecklistVersion, Type, ChecklistType, RelatedTo, Address, ScheduledDate, PreviousInspection) VALUES ('"
                                    + inspection.RecordType + "','"
                                    + inspection.Id + "','"
                                    + $scope.username + "','"
                                    + inspection.Name + "','"
                                    + checklistVersion + "','"
                                    + inspection.Type + "', ?, '"
                                    + inspection.RelatedTo + "', ?,'"
                                    + inspection.ScheduledDate + "','"
                                    + inspection.PreviousInspection + "')", [inspection.ChecklistType, inspection.Address]);
                                if (inspection.PreviousInspection && inspection.PreviousInspection != '') {
                                    $scope.downloadAnswers(inspection);
                                }
                            } else {
                                //Update scheduled start date on the existing record
                                db.transaction(function (tx) {
                                    tx.executeSql("UPDATE Inspection SET ScheduledDate = '" + inspection.ScheduledDate + "' WHERE Id = '" + inspection.Id + "'");
                                }, function (error) {
                                    console.log('saveLocally update error=' + JSON.stringify(error));
                                }, function () {
                                    // Success
                                });
                            }

                        }, function (error) {
                            console.log('saveLocally executeSql error: ' + JSON.stringify(error));
                        });
                    });
                }, function (error) {
                    console.log('saveLocally executeSql error: ' + JSON.stringify(error));
                });
            }, function (error) { // Transaction error
                console.log('saveLocally transaction error: ' + JSON.stringify(error));
            }, function () { // Transaction success
                $scope.getAllInspections(notificationMsg, notificationTitle);
                window.hideLoadingMask();
            });
        }
    };

    // Retrieve all inspections, which owns by current logged in user, from local database
    $scope.getAllInspections = function (notificationMsg, notificationTitle) {
        window.showLoadingMask('<h2>Syncing Data...</h2><p>Your data is being synced with the system.</p>');
        if (window.useIndexedDb) {
            $scope.inspections = [];
            var tx = window.db.transaction("Inspection", "readwrite");
            var store = tx.objectStore("Inspection");
            var index = store.index("by_InspectorId");

            index.openCursor(IDBKeyRange.only($scope.username)).onsuccess = function (event) {
                var inspectionCursor = event.target.result;
                var inspectionItem;

                if (inspectionCursor) {
                    inspectionItem = angular.copy(inspectionCursor.value);
                    $scope.inspections.push(inspectionItem);
                    inspectionCursor.continue();
                } else { // Done
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                    $timeout(function () {
                        $($element).find('ul').listview('refresh');
                    }, 0);
                    window.hideLoadingMask();
                }
            };
        } else {
            $scope.inspections = [];
            window.db.transaction(function (tx) {
                tx.executeSql("SELECT * FROM Inspection WHERE InspectorId = '" + $scope.username + "' COLLATE NOCASE ORDER BY ScheduledDate ASC",
                [],

                // Success, display the list of inspections on the page
                function (tx, results) {

                    inspectionids = '';
                    inspectionKeys = {};
                    for (var i = 0; i < results.rows.length; i++) {
                        var inspectionItem = angular.copy(results.rows.item(i));
                        if (moment(inspectionItem.ScheduledDate, window.dateFormat).isBefore(moment(), 'day')) {
                            inspectionItem.isOverdue = true;
                        }
                        
                        inspectionItem.attachedImages = [];
                        $scope.inspections.push(inspectionItem);
                        inspectionids += ',' + "'" + inspectionItem.Id + "'";
                        inspectionKeys[inspectionItem.Id] = i;
                    }

                    inspectionids = inspectionids.slice(1);
                    tx.executeSql("SELECT * FROM Attachment WHERE InspectionId in( " + inspectionids + ")",
                        [],
                        function(tx, res) {                            
                            for (var j=0; j < res.rows.length; j++) {
                                var attach = angular.copy(res.rows.item(j));    
                                $scope.inspections[inspectionKeys[attach.InspectionId]].attachedImages.push(attach);
                            }
                        },
                        function(error) {
                            console.log('getAllInspections select error: ' + JSON.stringify(error));
                        });

                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                    $timeout(function () {
                        if (notificationMsg) {
                            navigator.notification.alert(notificationMsg, null, notificationTitle);
                        }
                        window.hideLoadingMask();
                    }, 0);
                },

                // Error
                function (error) {
                    console.log('getAllInspections select error: ' + JSON.stringify(error));
                }
            )
            }, function (error) {
                // Transaction error
                console.log('getAllInspections transaction error: ' + JSON.stringify(error));
                window.hideLoadingMask();
            });
        }
    };

    // Sync down inspections
    $scope.downloadInspections = function (notificationMsg, notificationTitle) {
        window.showLoadingMask('<h2>Syncing Data...</h2><p>Your data is being synced with the system.</p>');

        var inspectionListQuery = "SELECT RecordType.Id, Id, Name, MUSW__Type__c, MUSW__Scheduled_Start_Date__c, Checklist_Type__c, Checklist_Version__c, Related_Address__c, Related_To__c, MUSW__Previous_Inspection__c FROM MUSW__Inspection__c WHERE  MUSW__Scheduled_Start_Date__c <= TODAY AND Download__c = true AND Owner.Username ='" + $scope.username + "'";
        
        if (window.isDebugMode) {
            console.log('inspectionList controller sforce query= ' + inspectionListQuery);
        }

        sforce.connection.query(inspectionListQuery, {
            onSuccess: function (result) {
                if (window.isDebugMode) {
                    console.log('inspectionList controller sforce inspectionListQuery result= ' + JSON.stringify(result));
                    console.log('inspectionList controller sforce inspectionListQuery result size= ' + result.size);
                }

                //Put id of question type into an array, and remove duplicate values
                var inspections = [];
                $.each(result.getArray('records'), function (index, inspection) {
                    // Make sure we have the right checklist for this inspection
                    if (inspection.Checklist_Version__c) {
                        $rootScope.$emit('downloadChecklist', {
                            type: inspection.Checklist_Type__c,
                            version: inspection.Checklist_Version__c
                        });
                    }

                    inspections.push({
                        RecordType: inspection.RecordType.Id,
                        Id: inspection.Id,
                        Name: inspection.Name,
                        Type: inspection.MUSW__Type__c,
                        RelatedTo: inspection.Related_To__c,
                        Address: inspection.Related_Address__c,
                        ScheduledDate: inspection.MUSW__Scheduled_Start_Date__c,
                        PreviousInspection: inspection.MUSW__Previous_Inspection__c ? inspection.MUSW__Previous_Inspection__c : '',
                        ChecklistVersion: inspection.Checklist_Version__c,
                        ChecklistType: inspection.Checklist_Type__c
                    });
                });

                if (inspections.length > 0) {
                    $scope.saveLocally(inspections, notificationMsg, notificationTitle);
                    $scope.downloadStatus();
                } else {
                    $scope.getAllInspections(notificationMsg, notificationTitle);
                }
                window.hideLoadingMask();
            },
            onFailure: function (error) {
                if (notificationMsg) { // The user clicks on download button
                    if (error.faultcode == 'sf:INVALID_SESSION_ID') {
                        navigator.notification.alert('Unable to download your inspections list with this session ID. Please log out and log in again.', null, 'Download failed');
                    } else {
                        if (!(error.message == null || error.message.trim() == '')) {
                            navigator.notification.alert('Salesforce error message - ' + error.message, null, 'Download failed');
                        } else {
                            navigator.notification.alert(error + '\n Unable to download your inspections list due to a poor network connection. Please try again later.', null, 'Download failed');
                        }
                    }
                }
                window.hideLoadingMask();
            }
        });
    };

    // Get all answers associated with this inspection(mostly used for reinspection)
    $scope.downloadAnswers = function (inspection) {
        window.showLoadingMask('<h2>Syncing Data...</h2><p>Your data is being synced with the system.</p>');

        var answersQuery = "SELECT Id, Name, BGCK__Comments__c, BGCK__Question__c, Inspection__r.MUSW__Status__c FROM BGCK__Answer__c WHERE Inspection__c = '" + inspection.PreviousInspection + "'";
        if (window.isDebugMode) {
            console.log('inspectionList controller downloadAnswers sforce query= ' + answersQuery);
        }

        sforce.connection.query(answersQuery, {
            onSuccess: function (result) {

                if (window.isDebugMode) {
                    console.log('inspectionList controller sforce downloadAnswers result= ' + JSON.stringify(result));
                    console.log('inspectionList controller sforce downloadAnswers result size= ' + result.size);
                }

                if (result.size > 0) {
                    if (window.useIndexedDb) {
                        var tx = window.db.transaction("Answer", "readwrite");
                        var store = tx.objectStore("Answer");
                        var answersToBeSaved = [];
                        var downloadedAnswers = result.getArray('records');

                        // Filter out the answers that don't exist.
                        var i = 0;
                        var saveNonExistedAnswers = function () {
                            if (i < downloadedAnswers.length) {
                                var answer = downloadedAnswers[i];
                                store.get(inspection.Id + answer.BGCK__Question__c).onsuccess = function (event) {
                                    if (!event.target.result) { // Not found
                                        answersToBeSaved.push({
                                            inspectionQuestionId: inspection.Id + answer.BGCK__Question__c,
                                            QuestionId: answer.BGCK__Question__c,
                                            InspectionId: inspection.Id,
                                            Response: answer.Name,
                                            Comments: answer.BGCK__Comments__c
                                        });
                                    }
                                    i++;
                                    saveNonExistedAnswers();
                                }
                            } else { // Completed
                                window.bulkDbInsert(answersToBeSaved, store, function () {
                                    window.hideLoadingMask();
                                });
                            }
                        };
                        saveNonExistedAnswers();
                    } else {
                        // First check if this answer for this inspection exists.
                        window.db.transaction(function (tx) {
                            //Update scheduled start date on the existing record
                            tx.executeSql("SELECT * FROM Answer WHERE InspectionId = '" + inspection.Id + "'",
                            [], function (tx, results) {// Success
                                // Insert the new records into the database if they didn't exist
                                if (results.rows.length == 0) {
                                    $.each(result.getArray('records'), function (index, answer) {
                                        if (answer.Name == 'Unsatisfactory' || answer.Name == 'Fail') {
                                            tx.executeSql("INSERT INTO Answer (QuestionId, InspectionId, Comments) VALUES ('"
                                                + answer.BGCK__Question__c + "','"
                                                + inspection.Id + "',?)", [answer.BGCK__Comments__c]);
                                        } else {
                                            tx.executeSql("INSERT INTO Answer (QuestionId, InspectionId, Response, Comments) VALUES ('"
                                                + answer.BGCK__Question__c + "','"
                                                + inspection.Id + "','"
                                                + answer.Name + "',?)", [answer.BGCK__Comments__c]);
                                        }
                                    });
                                }

                                //Update previous inspection status
                                tx.executeSql("UPDATE Inspection SET PreviousInspectionStatus = '" + result.getArray('records')[0].Inspection__r.MUSW__Status__c + "' WHERE Id = '" + inspection.Id + "'");

                            }, function (error) {
                                console.log('loadExistingAnswers executeSql error: ' + JSON.stringify(error));
                            });
                        }, function (error) { // Transaction error
                            console.log('loadExistingAnswers transaction error: ' + JSON.stringify(error));
                            window.hideLoadingMask();
                        }, function () { // Transaction success
                            window.hideLoadingMask();
                        });
                    }
                } else {
                    window.hideLoadingMask();
                }
            },
            onFailure: function (error) {
                if (notificationMsg) { // The user clicks on download button
                    if (error.faultcode == 'sf:INVALID_SESSION_ID') {
                        navigator.notification.alert('Unable to download re-inspection answers with this session ID. Please log out and log in again.', null, 'Download failed');
                    } else {
                        navigator.notification.alert('Unable to download re-inspection answers due to a poor network connection. Please try again later.', null, 'Download failed');
                    }
                }
                window.hideLoadingMask();
            }
        });
    };

    // Sync inspections up to SF
    $scope.uploadInspections = function () {
        if (navigator.connection.type != Connection.NONE) {
            window.showLoadingMask('<h2>Syncing Data...</h2><p>Your data is being synced with the system.</p>');
            var inspectionUploadedCounts = 0;
            $scope.isUploading = true;
            //Get all completed inspections
            var inspectionsToUpload = [];
            var signaturesToUpload = [];
          
            $.each($scope.inspections, function (index, inspection) {
                if (inspection.Status) { //Translate local DB object into SF object
                    var inspectionToUpload = new sforce.SObject('MUSW__Inspection__c');
                    var signatureToUpload = new sforce.SObject('Attachment');
                    inspectionToUpload.Id = inspection.Id;
                    inspectionToUpload.Travel_Duration_Min__c = inspection.TravelDurationMin;
                    inspectionToUpload.Break_Duration_Min__c = inspection.BreakDurationMin;
                    inspectionToUpload.Notes__c = inspection.Notes;
                    if (!(inspection.RescheduleDate == '' || inspection.RescheduleDate == null)) {
                        inspectionToUpload.Reschedule_Date__c = inspection.RescheduleDate;
                    }
                    inspectionToUpload.Checklist_Version__c = inspection.ChecklistVersion;
                    inspectionToUpload.MUSW__Status__c = 'Compliant';
                    var startTime, endTime;
                    if (!(inspection.StartTime == '' || inspection.StartTime == null)) {
                        startTime = moment(inspection.StartTime, window.timeFormat);
                        inspectionToUpload.Start_Time__c = moment(inspection.InspectionCompletedDatetime).hour(startTime.hour()).minute(startTime.minute()).toDate();
                    }
                    if (!(inspection.EndTime == '' || inspection.EndTime == null)) {
                        endTime = moment(inspection.EndTime, window.timeFormat);
                        inspectionToUpload.End_Time__c = moment(inspection.InspectionCompletedDatetime).hour(endTime.hour()).minute(endTime.minute()).toDate();
                    }

                    
                    inspectionToUpload.Days_To_Next_Inspection__c = inspection.DaysToReinspection;
                    inspectionToUpload.Download__c = false;
                    inspectionToUpload.MUSW__Completed_Date__c = new Date();

                    switch (inspection.Status) {
                        case 'Canceled': // Additional data for canceled inspection record
                            inspectionToUpload.MUSW__Status__c = 'Canceled';
                            break;
                        case 'Failed':
                            inspectionToUpload.Stop_Sale__c = inspection.StopSale;
                            if (inspection.StopSale == 'true') {
                                inspectionToUpload.MUSW__Status__c = 'Non-Compliant Stop-Sale';
                            } else {
                                inspectionToUpload.MUSW__Status__c = 'Non-Compliant';
                            }
                            break;
                    }

                    inspectionToUpload.MUSW__Status__c = inspection.Status;

                    if (inspection.AuditeeName) {

                        inspectionToUpload.Respondent_Name__c = inspection.AuditeeName;
                        inspectionToUpload.Respondent_Email__c = inspection.AuditeeEmail;
                        inspectionToUpload.CAN_Count__c = inspection.CanCount;
                        inspectionToUpload.IAR_Count__c = inspection.IarCount;                        

                        signatureToUpload.Body = inspection.AuditeeSignature.slice(22); //Take out "data:image/png;base64," part of the data
                        signatureToUpload.Name = 'Respondent Signature';
                        signatureToUpload.ContentType = 'image/png';
                        signatureToUpload.ParentId = inspection.Id;
                        //signatureToUpload.Respondent_Signature__c = inspection.AuditeeSignature;
                    }
                    
                    signaturesToUpload.push(signatureToUpload);                    

                    // upload attachment Images    
                    if (typeof inspection.attachedImages != 'undefined') {

                        $.each(inspection.attachedImages, function (index, image) {
                            var imageToUpload = new sforce.SObject('Attachment');
                            imageToUpload.Body = image.ImgData;
                            imageToUpload.Name = 'Photo';
                            imageToUpload.ContentType = 'image/jpeg';
                            imageToUpload.ParentId = image.InspectionId;                        
                            signaturesToUpload.push(imageToUpload);                     
                        });
                        console.log('attacjed') ;
                    }                    

                    inspectionsToUpload.push(inspectionToUpload);
                    inspectionUploadedCounts++;
                }
            });

            // Upload answers and inspections
            var inspectionUploadResult;
            try {
                inspectionUploadResult = sforce.connection.update(inspectionsToUpload); // Upload inspections
            } catch (error) {
                if (isDebugMode) {
                    navigator.notification.alert(JSON.stringify(error), null, 'Upload failed');                    
                } else {
                    console.log(error);
                }
                if (error.code = 19) {
                    navigator.notification.alert('The upload has failed due to a network connection error. Please make sure you are connected to the Internet and try again.', null, 'Upload failed');
                } else {
                    navigator.notification.alert('The upload has failed due to an unknown issue. Please try again later.', null, 'Upload failed');
                }
                $scope.isUploading = false;
                window.hideLoadingMask();
                localStorage.setItem('LastUploadErrorLog', JSON.stringify(error));
                return false;
            }
            if (inspectionUploadResult) {
                var isInspectionUploadSuccess = true;
                $.each(inspectionUploadResult, function (index, result) {
                    if (result.getBoolean('success')) {
                        if (inspectionsToUpload.length == index + 1) {
                            // Success, upload signature
                            var signatureUploadResult = sforce.connection.create(signaturesToUpload);
                            if (signatureUploadResult) {
                                // Success uploading signature
                            } else {
                                // Failed to upload signature, notify the user
                                isInspectionUploadSuccess = false;
                                $scope.isUploading = false;
                                window.hideLoadingMask();

                                if (window.isDebugMode) {
                                    navigator.notification.alert(JSON.stringify(signatureUploadResult), null, 'Upload Signature failed');
                                } else {
                                    navigator.notification.alert('The upload has failed due to a communication issue with the system. Please try again later.', null, 'Upload failed');
                                    localStorage.setItem('LastUploadErrorLog', signatureUploadResult);    
                                }                                
                                //navigator.notification.alert(JSON.stringify(result), null, 'Upload failed'); // TODO: PAN Remove after debug
                            }
                        }
                    } else {
                        // Failed to upload inspection, notify the user
                        isInspectionUploadSuccess = false;
                        $scope.isUploading = false;
                        window.hideLoadingMask();
			if (window.isDebugMode) {
                        	navigator.notification.alert(JSON.stringify(result), null, 'Inspection Upload failed');
                        } else {
                        	navigator.notification.alert('The upload has failed due to a communication issue with the system. Please try again later.', null, 'Upload failed');
			}		
                        localStorage.setItem('LastUploadErrorLog', result);
                        //navigator.notification.alert(JSON.stringify(result), null, 'Upload failed'); // TODO: PAN Remove after debug
                    }
                });

                if (window.useIndexedDb) {
                    //Get all questions associated with inspections to upload
                    var answersToUpload = [];
                    var answersToDelete = [];
                    var inspectionIdCount = 0;
                    var getAllAnswersToBeUploaded = function (inspectionsToUpload) {
                        var tx = window.db.transaction("Answer", "readwrite");
                        var store = tx.objectStore("Answer");
                        var index = store.index("by_InspectionId");

                        index.openCursor(IDBKeyRange.only(inspectionsToUpload[inspectionIdCount].Id)).onsuccess = function (event) {
                            var answerCursor = event.target.result;
                            var answer;

                            if (answerCursor) {
                                answer = angular.copy(answerCursor.value);

                                var answerToUpload = new sforce.SObject('BGCK__Answer__c');
                                answerToUpload.BGCK__Question__c = answer.QuestionId;
                                answerToUpload.Inspection__c = answer.InspectionId;
                                answerToUpload.Name = answer.Response;
                                answerToUpload.BGCK__Comments__c = answer.Comments;
                                answerToUpload.Corrective_Action__c = (answer.Response == 'CAN' || answer.Response == 'IAR') ? answer.CorrectiveAction : '';

                                if (inspectionsToUpload[inspectionIdCount].MUSW__Status__c != 'Canceled') {
                                    answersToUpload.push(answerToUpload);
                                }
                                answersToDelete.push(answerToUpload);

                                answerCursor.continue();
                            } else { // Done cursor
                                inspectionIdCount++;
                                if (inspectionIdCount < inspectionsToUpload.length) { // There're more inspection answers to upload
                                    getAllAnswersToBeUploaded(inspectionsToUpload);
                                } else { // Done inspections list
                                    var isAnswersUploadSuccess = true;
                                    var uploadedCount = 0;
                                    while (uploadedCount < answersToUpload.length) {
                                        var answerUploadResult = sforce.connection.create(answersToUpload.slice(uploadedCount, uploadedCount + window.sfUploadBatchSize));
                                        $.each(answerUploadResult, function (index, result) {
                                            if (result.getBoolean('success')) {

                                            } else {
                                                // Failed to upload answer, notify the user
                                                if (window.isDebugMode) {
                                                    navigator.notification.alert(JSON.stringify(result), null, 'Upload failed');
                                                } else {
                                                    navigator.notification.alert('The answers upload has failed due to a network connection error. Please make sure you are connected to the Internet and try again.', null, 'Upload failed');    
                                                }                                                
                                                isAnswersUploadSuccess = false;
                                                $scope.isUploading = false;
                                                window.hideLoadingMask();
                                                return false;
                                            }
                                        });

                                        if (isAnswersUploadSuccess) { // Current set of upload completed
                                            uploadedCount += window.sfUploadBatchSize;
                                        } else {
                                            break;
                                        }
                                    }

                                    if (isAnswersUploadSuccess) {
                                        // upload success
                                        var inspectionTx = window.db.transaction("Inspection", "readwrite");
                                        var inspectionStore = inspectionTx.objectStore("Inspection");
                                        var answerTx = window.db.transaction("Answer", "readwrite");
                                        var answerStore = answerTx.objectStore("Answer");

                                        // Delete uploaded inspections
                                        $.each(inspectionsToUpload, function (index, uploadedInspection) {
                                            inspectionStore.delete(uploadedInspection.Id);
                                        });

                                        // Delete uploaded answers
                                        $.each(answersToDelete, function (index, answerToDelete) {
                                            inspectionStore.delete(answerToDelete.Inspection__c + answerToDelete.BGCK__Question__c);
                                        });
                                        $scope.refreshInspections();
                                        $scope.isUploading = false;
                                        window.hideLoadingMask();
                                    }
                                }
                            }
                        };
                    }

                    if (isInspectionUploadSuccess) {
                        getAllAnswersToBeUploaded(inspectionsToUpload);
                    }
                } else {
                    var toBeDeletedInspectionIds = '';
                    if (isInspectionUploadSuccess) {

                        var uploadInspectionIds = '';
                        for (var i = 0; i < inspectionsToUpload.length; i++) {
                            // Prevent canceled inspection questions from being uploaded
                            //if (inspectionsToUpload[i].MUSW__Status__c != 'Canceled') {
                                if (uploadInspectionIds != '') { // if not empty, means this is not the first inspection added to the list, hence a comma is required
                                    uploadInspectionIds += ',';
                                }
                                uploadInspectionIds += "'" + inspectionsToUpload[i].Id + "'";
                            //}

                            // Collects all inspections that has to be deleted after upload completed
                            if (toBeDeletedInspectionIds != '') { // if not empty, means this is not the first inspection added to the list, hence a comma is required
                                toBeDeletedInspectionIds += ',';
                            }
                            toBeDeletedInspectionIds += "'" + inspectionsToUpload[i].Id + "'";
                        }

                        //Get all questions associated with inspections to upload
                        var answersToUpload = [];
                        if (uploadInspectionIds != '') {
                            db.transaction(function (tx) {
                                tx.executeSql("\
                                    SELECT * FROM Answer\
                                    WHERE InspectionId IN (" + uploadInspectionIds + ")\
                                ",
                                [],

                                // Success
                                function (tx, results) {
                                    for (var i = 0; i < results.rows.length; i++) {
                                        var answer = results.rows.item(i);

                                        var answerToUpload = new sforce.SObject('BGCK__Answer__c');
                                        answerToUpload.BGCK__Question__c = answer.QuestionId;
                                        answerToUpload.Inspection__c = answer.InspectionId;
                                        answerToUpload.Name = answer.Response;
                                        answerToUpload.BGCK__Comments__c = answer.Comments;
                                        answerToUpload.Corrective_Action__c = (answer.Response == 'CAN' || answer.Response == 'IAR') ? answer.CorrectiveAction : '';
                                        answerToUpload.Inspection_Question_Id__c = answer.InspectionId + answer.QuestionId;

                                        answersToUpload.push(answerToUpload);
                                    }


                                    var isAnswersUploadSuccess = true;
                                    var uploadedCount = 0;
                                    while (uploadedCount < answersToUpload.length) {
                                        var answerUploadResult = sforce.connection.upsert('Inspection_Question_Id__c', answersToUpload.slice(uploadedCount, uploadedCount + window.sfUploadBatchSize));
                                        $.each(answerUploadResult, function (index, result) {
                                            if (!result.getBoolean('success')) {
                                                // Failed to upload answer, notify the user
                                                isAnswersUploadSuccess = false;
                                                $scope.isUploading = false;
                                                if (window.isDebugMode) {
                                                    navigator.notification.alert(JSON.stringify(result), null, 'Upload Insepction Question failed');
                                                } else {
                                                    navigator.notification.alert('The answers upload has failed due to a network connection error. Please make sure you are connected to the Internet and try again.', null, 'Upload failed');
                                                }
                                                window.hideLoadingMask();
                                                return false;
                                            }
                                        });

                                        if (isAnswersUploadSuccess) { // Current set of upload completed
                                            uploadedCount += window.sfUploadBatchSize;
                                        } else {
                                            break;
                                        }
                                    }

                                    if (isAnswersUploadSuccess) {
                                        // upload success
                                        db.transaction(function (tx) {
                                            tx.executeSql("DELETE FROM Inspection WHERE Id IN (" + toBeDeletedInspectionIds + ")");
                                            tx.executeSql("DELETE FROM Answer WHERE InspectionId IN (" + toBeDeletedInspectionIds + ")");
                                            tx.executeSql("DELETE FROM Attachment WHERE InspectionId IN (" + toBeDeletedInspectionIds + ")");

                                        }, function (error) {
                                            if (window.isDebugMode) {
                                                navigator.notification.alert('delete inspection after upload error=' + JSON.stringify(error));
                                            } else {
                                                console.log('delete inspection after upload error=' + JSON.stringify(error));    
                                            }                                            
                                        }, function () {
                                            // Notify user and refresh the list
                                            $scope.refreshInspections();
                                            $scope.isUploading = false;
                                            window.hideLoadingMask();
                                            navigator.notification.alert('Successfully uploaded ' + inspectionUploadedCounts + ' inspections.', null, 'Upload completed');
                                        });
                                    }
                                },

                                // Error
                                function (error) {
                                    if (window.isDebugMode) {
                                        navigator.notification.alert('uploadInspections answers select error: ' + JSON.stringify(error));
                                    } else {
                                        console.log('uploadInspections answers select error: ' + JSON.stringify(error));    
                                    }
                                }
                            )
                            }, function (error) {
                                // Transaction error
                                if (window.isDebugMode) {
                                    navigator.notification.alert('uploadInspections answers transaction error: ' + JSON.stringify(error));
                                } else {
                                    console.log('uploadInspections answers transaction error: ' + JSON.stringify(error));
                                }

                            });
                        } else {
                            // upload success
                            db.transaction(function (tx) {
                                tx.executeSql("DELETE FROM Inspection WHERE Id IN (" + toBeDeletedInspectionIds + ")");
                            }, function (error) {
                                if (window.isDebugMode) {
                                    navigator.notification.alert('delete inspection after upload error=' + JSON.stringify(error));
                                } else {
                                    console.log('delete inspection after upload error=' + JSON.stringify(error));
                                }
                            }, function () {
                                // Notify user and refresh the list
                                $scope.refreshInspections();
                                $scope.isUploading = false;
                                window.hideLoadingMask();
                                navigator.notification.alert('Successfully uploaded ' + inspectionUploadedCounts + ' inspections.', null, 'Upload completed');
                            });
                        }
                    }
                }
            } else {
                navigator.notification.alert('The upload has failed due to a network connection error. Please make sure you are connected to the Internet and try again.', null, 'Upload failed');
                localStorage.setItem('LastUploadErrorLog', inspectionUploadResult);
            }
        } else { // Has no Internet connection
            navigator.notification.alert('You are not currently connected to the Internet. Please connect and try again.');
        }
    };

    // Handler when a user clicks on Start Inspection button
    $scope.startInspection = function (inspection) {
        window.showLoadingMask('<h2>Inspection Loading...</h2><p>Your inspection is loading.</p>');
        $timeout(function () {
            if(inspection.ChecklistVersion == 'undefined'){
                $rootScope.$emit('showSummaryPage', {
                    inspection: inspection,
                    questions: null,
                    isCompleted: true,
                    isViewMode: false
                });
            } else {
                $rootScope.$emit('startInspection', {
                    id: inspection.Id,
                    type: inspection.ChecklistType,
                    inspection: inspection,
                    isViewMode: false
                });
            }
            window.hideLoadingMask();
        }, 0);
    };

    // Handler when a user clicks on Resume Inspection button
    $scope.resumeInspection = function (inspection) {
        window.showLoadingMask('<h2>Inspection Loading...</h2><p>Your inspection is loading.</p>');
        $timeout(function () {
            if(inspection.ChecklistVersion == 'undefined'){
                $rootScope.$emit('showSummaryPage', {
                    inspection: inspection,
                    questions: null,
                    isCompleted: true,
                    isViewMode: false
                });
            } else {
                $rootScope.$emit('startInspection', {
                    id: inspection.Id,
                    type: inspection.ChecklistType,
                    inspection: inspection,
                    isViewMode: false,
                    isResume: true
                });
            }
            window.hideLoadingMask();
        }, 0);
    };

    $scope.cancelInspection = function (inspection) {
        //Store travel time, reinspection date, etc. in local database
        db.transaction(function (tx) {
            tx.executeSql("UPDATE Inspection SET Status = 'Canceled' WHERE Id = '" + inspection.Id + "'");
        }, function (error) {
            console.log('cancelInspection update error=' + JSON.stringify(error));
        }, function () {
            $scope.getAllInspections();
        });
    };

    $scope.viewSummary = function (inspection) {
        window.showLoadingMask('<h2>Summary Loading...</h2><p>Your summary is loading.</p>');
        db.transaction(function (tx) {
            // Get the attachments
            tx.executeSql("\
                SELECT * FROM Attachment\
                WHERE InspectionId = '" + inspection.Id + "'\
            ",
            [],
            function (tx, results) {// Success
                inspection.attachedImages = [];
                for (var i = 0; i < results.rows.length; i++) {
                    inspection.attachedImages.push(results.rows.item(i));
                }
            },
            function (error) { // Error
                console.log('viewSummary attachments select error: ' + JSON.stringify(error));
            });

        }, function (error) {
            // Transaction error
            console.log('viewSummary attachment transaction error: ' + JSON.stringify(error));
            window.hideLoadingMask();
        }, function () { // Transaction success
            $rootScope.$emit('showSummaryPage', {
                inspection: inspection,
                questions: $scope.questions,
                isViewMode: true
            });
            window.hideLoadingMask();
        });
    };

    $scope.refreshInspections = function () {
        //If online download the inspection from the server, otherwise retrieve inspection list locally
        if (navigator.connection.type != Connection.NONE && !$scope.isUploading) {
            $scope.downloadInspections();
        } else {
            $scope.getAllInspections();
        }
    };

    // Download the latest checklist version and check to see if it's got updated
    $scope.downloadChecklistVersion = function () {
        if (navigator.connection.type != Connection.NONE) {
            window.showLoadingMask("<h2>Starting Application...</h2><p>The application is loading.</p>");
            //var currentChecklistVersion = JSON.parse(localStorage.getItem('ChecklistVersion'));

            var checklistVersionQuery = "SELECT Id, Name, BGCK__Object_Value__c, BGCK__Current_Version__c FROM BGCK__Checklist__c WHERE BGCK__Version_Commit__c = true";
            if (window.isDebugMode) {
                console.log('downloadChecklistVersion sforce query= ' + checklistVersionQuery);
            }
            sforce.connection.query(checklistVersionQuery, {
                onSuccess: function (result) {
                    if (window.isDebugMode) {
                        console.log('downloadChecklistVersion sforce query result= ' + JSON.stringify(result));
                        console.log('downloadChecklistVersion sforce query result size= ' + result.size);
                    }
                    if ($.isArray(result.records)) {
                        $scope.checklistVersion = result.records;
                    } else { // Make an array if the returned result is not an array
                        $scope.checklistVersion = [result.records];
                    }

                    localStorage.setItem('ChecklistVersion', JSON.stringify($scope.checklistVersion));

                    $rootScope.$emit('updateChecklistVersion', {
                        checklistVersion: $scope.checklistVersion
                    });
                    window.hideLoadingMask();
                },
                onFailure: function (error) {
                    //TODO: take care of error handling
                    window.hideLoadingMask();
                }
            });
        }
    };

    // Sync down status
    $scope.downloadStatus = function (notificationMsg, notificationTitle) {
        window.showLoadingMask('<h2>Syncing Data...</h2><p>Your data is being synced with the system.</p>');

        var sfRecordTypeMappings = sforce.connection.describeLayout('MUSW__Inspection__c').recordTypeMappings;
        $scope.statusPicklists = {};
        $.each(sfRecordTypeMappings, function (index, element) {
            var statusPicklist = null;
            $.each(element.picklistsForRecordType, function (idx, ele) {
                if (ele.picklistName == 'MUSW__Status__c') {
                    statusPicklist = ele.picklistValues;
                    return false;
                }
            });

            $scope.statusPicklists[element.recordTypeId] = statusPicklist;
        });
        window.localStorage.setItem('StatusPicklistsValues', JSON.stringify($scope.statusPicklists));

        window.hideLoadingMask();
    };

    //Once the user logged in, change the page and download inspection
    $rootScope.$on('loggedIn', function (event, arg) {
        window.showLoadingMask("<h2>Starting Application...</h2><p>The application is loading.</p>");
        if (window.isDebugMode) {
            console.log('User logged in username = ' + arg.username);
        }

        // Update all checklists to the latest version
        $scope.downloadChecklistVersion();

        $scope.username = arg.username;

        $.mobile.pageContainer.pagecontainer('change', '#inspection-list-page', {
            transition: 'slide'
        });

        $scope.refreshInspections();

        window.hideLoadingMask();
    });

    //Handler for after the user coompleted an inspection. The list should get refreshed.
    $rootScope.$on('completedInspection', function (event, arg) {
        $scope.refreshInspections();
    });
}]);
