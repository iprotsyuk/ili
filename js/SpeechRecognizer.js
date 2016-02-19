'use strict';

function SpeechRecognizer() {
    this._recognizer = null;
    this._recorder = null;
    this._callbackManager = null;
    this._audioContext = null;

    this.updateStatus("Initializing web audio and speech recognizer, waiting for approval to access the microphone");
    this._callbackManager = new CallbackManager();
    this.spawnWorker("js/lib/recognizer.js", function(worker) {
        // This is the onmessage function, once the worker is fully loaded
        worker.onmessage = function(e) {
            // This is the case when we have a callback id to be called
            if (e.data.hasOwnProperty('id')) {
                var clb = this._callbackManager.get(e.data['id']);
                var data = {};
                if (e.data.hasOwnProperty('data')) {
                    data = e.data.data;
                }
                if(clb) {
                    clb(data);
                }
            }
            // This is a case when the recognizer has a new hypothesis
            if (e.data.hasOwnProperty('hyp')) {
                var newHyp = e.data.hyp;
                if (e.data.hasOwnProperty('final') &&  e.data.final) {
                    newHyp = "Final: " + newHyp;
                }
                this.updateHyp(newHyp);
            }
            // This is the case when we have an error
            if (e.data.hasOwnProperty('status') && (e.data.status == "error")) {
                this.updateStatus("Error in " + e.data.command + " with code " + e.data.code);
            }
        }.bind(this);
        // Once the worker is fully loaded, we can call the initialize function
        this.initRecognizer();
    }.bind(this));

    // The following is to initialize Web Audio
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        window.URL = window.URL || window.webkitURL;
        this._audioContext = new AudioContext();
    } catch (e) {
        this.updateStatus("Error initializing Web Audio browser");
    }
    if (navigator.getUserMedia) {
        navigator.getUserMedia({audio: true}, this.startUserMedia.bind(this), function(e) {
            this.updateStatus("No live audio input in this browser");
        }.bind(this));
    } else {
        this.updateStatus("No web audio support in this browser");
    }
}


SpeechRecognizer.prototype = Object.create(null, {
    // A convenience function to post a message to the recognizer and associate
    // a callback to its response
    postRecognizerJob: {
        value: function(message, callback) {
            var msg = message || {};
            if (this._callbackManager) {
                msg.callbackId = this._callbackManager.add(callback);
            }
            if (this._recognizer) {
                this._recognizer.postMessage(msg);
            }
        }
    },

    // This function initializes an instance of the recorder
    // it posts a message right away and calls onReady when it
    // is ready so that onmessage can be properly set
    spawnWorker: {
        value: function(workerURL, onReady) {
            this._recognizer = new Worker(workerURL);
            this._recognizer.onmessage = function(event) {
                onReady(this._recognizer);
            }.bind(this);
            this._recognizer.postMessage('');
        }
    },

    // To display the hypothesis sent by the recognizer
    updateHyp: {
        value: function (hyp) {
            console.log(hyp);
            //alert(hyp);
        }
    },

    // This is just a logging window where we display the status
    updateStatus: {
        value: function(newStatus) {
            console.log('Speech recognizer status: ' + newStatus);
        }
    },

    // Callback function once the user authorises access to the microphone
    // in it, we instanciate the recorder
    startUserMedia: {
        value: function(stream) {
            var input = this._audioContext.createMediaStreamSource(stream);
            // Firefox hack https://support.mozilla.org/en-US/questions/984179
            window.firefox_audio_hack = input;
            var audioRecorderConfig = {errorCallback: function(x) {
                this.updateStatus("Error from recorder: " + x);
            }.bind(this)};
            this._recorder = new AudioRecorder(input, audioRecorderConfig);
            // If a recognizer is ready, we pass it to the recorder
            if (this._recognizer) {
                this._recorder.consumers = [this._recognizer];
            }
            this.updateStatus("Audio recorder ready");
            this.startRecording();
        }
    },

    // This starts recording. We first need to get the id of the grammar to use
    startRecording: {
        value: function () {
            if (this._recorder) {
                this._recorder.start(SpeechRecognizer.grammar.id);
            }
        }
    },

    // Stops recording
    stopRecording: {
        value: function () {
            if (this._recorder) {
                this._recorder.stop();
            }
        }
    },

    // Called once the recognizer is ready
    // We then add the grammars to the input select tag and update the UI
    recognizerReady: {
        value: function() {
            this.updateStatus("Recognizer ready");
        }
    },

    // This adds a grammar from the grammars array
    // We add them one by one and call it again as
    // a callback.
    // Once we are done adding all grammars, we can call
    // recognizerReady()
    feedGrammar: {
        value: function(g, id) {
            if (id) {
                g.id = id.id;
                this.recognizerReady();
            } else {
                this.postRecognizerJob({command: 'addGrammar', data: g.g},
                    function (id) {
                        this.feedGrammar(g, {id: id});
                    }.bind(this));
            }
        }
    },

    // This adds words to the recognizer. When it calls back, we add grammars
    feedWords: {
        value: function(words) {
            this.postRecognizerJob({command: 'addWords', data: words},
                function () {
                    this.feedGrammar(SpeechRecognizer.grammar, 0);
                }.bind(this));
        }
    },

    // This initializes the recognizer. When it calls back, we add words
    initRecognizer: {
        value: function() {
            // You can pass parameters to the recognizer, such as : {command: 'initialize', data: [["-hmm", "my_model"], ["-fwdflat", "no"]]}
            this.postRecognizerJob({command: 'initialize'},
                function() {
                    if (this._recorder) {
                        this._recorder.consumers = [this._recognizer];
                    }
                    this.feedWords(SpeechRecognizer.wordList);
                }.bind(this)
            );
        }
    }
});

// This is the list of words that need to be added to the recognizer
// This follows the CMU dictionary format
SpeechRecognizer.wordList = [['ALOHA', 'AH L OW HH AA'], ['MAHALO', 'M AH HH AA L OW'], ['ROTATE', 'R OW T EY T'], ['X', 'EH K S'], ['Y', 'W AY'], ['Z', 'Z IY'], ['CLOCKWISE', 'K L AA K W AY Z'], ['COUNTERCLOCKWISE', 'K AW N T ER K L AO K W AY Z'], ['FREEZE', 'F R IY Z']];
SpeechRecognizer.grammar = {
    title: 'VoiceControl',
    g: {
        numStates: 5,
        start: 0,
        end: 3,
        transitions: [
            {from: 0, to: 0, word: 'ALOHA'},
            {from: 0, to: 1, word: 'ROTATE'},
            {from: 1, to: 2, word: 'X'},
            {from: 1, to: 2, word: 'Y'},
            {from: 1, to: 2, word: 'Z'},
            {from: 2, to: 3, word: 'CLOCKWISE'},
            {from: 2, to: 3, word: 'COUNTERCLOCKWISE'},
            {from: 0, to: 0, word: 'FREEZE'},
            {from: 0, to: 0, word: 'MAHALO'}
        ]}
};
