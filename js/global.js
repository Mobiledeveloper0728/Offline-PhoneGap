if (window.isDebugMode) {
    console.log('START APP');
}

window.tgapApp = angular.module('tgap', [
    'ngTouch',
    'inspectionQuestions'
]).run(function ($rootScope) {
    FastClick.attach(document.body); // Attach FastClick library

    // Get application version from config.xml
    //$.get('./config.xml', function (data) {
    //    $rootScope.appVersion = $($.parseXML(data)).find('widget').attr('version');
    //}); 
    $rootScope.appVersion = window.appVersion;
});

var app = {
    // Application Constructor
    initialize: function () {
        if (window.isDebugMode) {
            console.log('initialize app');
        }
        this.bindEvents();
    },

    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function () {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },

    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicity call 'app.receivedEvent(...);'
    onDeviceReady: function () {
        app.receivedEvent('deviceready');
    },

    // Update DOM on a Received Event
    receivedEvent: function (id) {
        // Set all variables used in the app
        window.maskCount = 0;

        if (window.isDebugMode) {
            console.log('received event = ' + id);
        }

        if (window.useIndexedDb) {
            /* ------------- [START local IDB database preparation] ------------- */
            var openDbRequest = window.indexedDB.open("DPS", 1);

            openDbRequest.onupgradeneeded = function () {
                console.log('initiated database');
                // The database did not previously exist, so create object stores and indexes.
                window.db = openDbRequest.result;

                if (db.objectStoreNames.contains("Answer")) {
                    db.deleteObjectStore("Answer");
                }
                var answerStore = db.createObjectStore("Answer", {
                    keyPath: "inspectionQuestionId"
                });
                answerStore.createIndex("by_InspectionId", "InspectionId");
                answerStore.createIndex("by_ResponseAndInspectionId", ["Response", "InspectionId"]);
                answerStore.createIndex("by_CommentsAndResponseAndInspectionId", ["Comments", "Response", "InspectionId"]);

                if (db.objectStoreNames.contains("Inspection")) {
                    db.deleteObjectStore("Inspection");
                }
                var inspectionStore = db.createObjectStore("Inspection", {
                    keyPath: "Id"
                });
                inspectionStore.createIndex("by_InspectorId", "InspectorId");
            };

            openDbRequest.onsuccess = function () {
                window.db = openDbRequest.result;
            };


            // Utility function to insert data to indexed DB
            window.bulkDbInsertCount = 0;
            window.bulkDbInsert = function (items, objectStore, cbFn) {
                if (window.bulkDbInsertCount < items.length) { // There's more
                    objectStore.put(items[window.bulkDbInsertCount]).onsuccess = function (event) {
                        window.bulkDbInsertCount++;
                        window.bulkDbInsert(items, objectStore, cbFn);
                    }
                } else { // Complete
                    window.bulkDbInsertCount = 0;
                    cbFn();
                }
            };
            /* ------------- [START local IDB database preparation] ------------- */
        } else {
            /* ------------- [START local SQL database preparation] ------------- */
            window.db = window.openDatabase("DPS", "1.0", "DPS DB", (40 * 1000 * 1000)); // 40mb

            window.db.transaction(function (tx) {
                tx.executeSql("\
			        CREATE TABLE IF NOT EXISTS Answer\
			        (QuestionId, InspectionId, Response, Comments)\
		        ");
            }, function (error) {
                console.log('create answer table error=' + JSON.stringify(error));
            });

            window.db.transaction(function (tx) {
                tx.executeSql("\
			        CREATE TABLE IF NOT EXISTS Inspection\
			        (RecordType, Id, InspectorId, Name, Type, RelatedTo, Address, ScheduledDate, PreviousInspection, StartTime, EndTime, Status, Notes, InspectionCompletedDatetime, ChecklistVersion, PreviousInspectionStatus, UnsatCount, ChecklistType, DaysToReinspection, AuditeeName, AuditeeEmail, AuditeeSignature)\
		        ");
            }, function (error) {
                console.log('create inspection table error=' + JSON.stringify(error));
            });

            window.db.transaction(function (tx) {
                tx.executeSql("\
			        CREATE TABLE IF NOT EXISTS Attachment\
			        (Id, InspectionId, ImgData)\
		        ");
            }, function (error) {
                console.log('create attachment table error=' + JSON.stringify(error));
            });
            /* ------------- [START local SQL database preparation] ------------- */
        }


        /* ------------- [START Utility functions] ------------- */
        window.hashCode = function (string) {
            var hash = 0;
            if (string.length == 0) return hash;
            for (i = 0; i < string.length; i++) {
                char = string.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return hash;
        };

        window.escapeString = function (str) {
            return (str + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
        };

        window.loadingMaskJDom = $('.loading-overlay');
        window.loadingMsgDom = $('.loading-overlay.loading-msg');
        window.showLoadingMask = function (msg) {
            if (!window.loadingMaskJDom) {
                window.loadingMaskJDom = $('.loading-overlay');
                window.loadingMsgDom = $('.loading-overlay.loading-msg');
            }

            window.maskCount++;
            window.loadingMsgDom.html(msg);
            window.loadingMaskJDom.show();
        };

        window.hideLoadingMask = function () {
            window.maskCount--;
            if (window.maskCount < 0) {
                window.maskCount = 0;
            }

            if (!window.loadingMaskJDom) {
                window.loadingMaskJDom = $('.loading-overlay');
            }

            if (window.loadingMaskJDom && window.maskCount == 0) {
                setTimeout(function () {
                    window.loadingMaskJDom.hide();
                }, 1000);
            }
        }

        window.validateNumber = function(evt) {
            var charCode = (evt.which) ? evt.which : event.keyCode
            if (charCode > 31 && (charCode < 48 || charCode > 57)) {
                return false;
            }
            return true;
        };
        /* ------------- [END Utility functions] ------------- */

        // Manually bootstrap AngularJS
        angular.bootstrap(document, ['tgap']);
        $.mobile.ignoreContentEnabled = true;
        navigator.splashscreen.hide();
    }
};

app.initialize();
