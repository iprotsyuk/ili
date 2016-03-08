'use strict';

function VoiceControls(object, target) {
    this._voiceRecognizer = null;
    this._recorder = null;
    this._callbackManager = null;
    this._audioContext = null;
    this._hypothesesLimit = 1000;

    this.updateStatus('Initializing web audio and speech recognizer, waiting for approval to access the microphone');
    this._callbackManager = new CallbackManager();
    this._createVoiceRecognizer();
    this._createCommandProcessor(object, target);

    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        window.URL = window.URL || window.webkitURL;
        this._audioContext = new AudioContext();
    } catch (e) {
        this.updateStatus('Error initializing Web Audio browser');
    }
    if (navigator.getUserMedia) {
        navigator.getUserMedia({audio: true}, this.startUserMedia.bind(this), function(e) {
            this.updateStatus('No live audio input in this browser');
        }.bind(this));
    } else {
        this.updateStatus('No web audio support in this browser');
    }
}

VoiceControls.prototype = Object.create(null, {
    update: {
        value: function() {
            this._commandProcessor.updateObjectPosition();
        }
    },

    _postRecognizerJob: {
        value: function(message, callback) {
            var msg = message || {};
            if (this._callbackManager) {
                msg.callbackId = this._callbackManager.add(callback);
            }
            if (this._voiceRecognizer) {
                this._voiceRecognizer.postMessage(msg);
            }
        }
    },

    _createVoiceRecognizer: {
        value: function() {
            this._voiceRecognizer = new Worker('js/lib/recognizer.js');
            this._voiceRecognizer.onmessage = this._voiceRecognizerMessageHandler.bind(this);

            this._voiceRecognizer.postMessage('');
            this._initRecognizer();
        }
    },

    _voiceRecognizerMessageHandler: {
        value: function(e) {
            if (e.data.hasOwnProperty('id')) {
                var clb = this._callbackManager.get(e.data['id']);
                var data = {};
                if (e.data.hasOwnProperty('data')) {
                    data = e.data.data;
                }
                if (clb) {
                    clb(data);
                }
            }
            if (e.data.hasOwnProperty('hyp')) {
                this._commandProcessor.updateHypothesis(e.data.hypseg);

                if (e.data.hypseg.length > this._hypothesesLimit && !this._commandProcessor.active) {
                    this._postRecognizerJob({command: 'stop'});
                    window.setTimeout(function () {
                        this._postRecognizerJob({command: 'start'});
                        this._commandProcessor.reset();
                        this.updateStatus('Voice controller reset');
                    }.bind(this), 1000);
                }
            }
            if (e.data.hasOwnProperty('status') && (e.data.status == 'error')) {
                this.updateStatus('Error in ' + e.data.command + ' with code ' + e.data.code);
            }
        }
    },

    _createCommandProcessor: {
        value: function(object, target) {
            this._commandProcessor = new CommandProcessor(object, target);
        }
    },

    updateStatus: {
        value: function(newStatus) {
            console.log('Speech recognizer status: ' + newStatus);
        }
    },

    startUserMedia: {
        value: function(stream) {
            var input = this._audioContext.createMediaStreamSource(stream);
            window.firefox_audio_hack = input;
            var audioRecorderConfig = {errorCallback: function(x) {
                this.updateStatus('Error from recorder: ' + x);
            }.bind(this)};
            this._recorder = new AudioRecorder(input, audioRecorderConfig);

            if (this._voiceRecognizer) {
                this._recorder.consumers = [this._voiceRecognizer];
            }
            this.updateStatus('User approval received');
            this.updateStatus('Audio recorder ready');
            this.startRecording();
        }
    },

    startRecording: {
        value: function () {
            if (this._recorder) {
                this._recorder.start(CommandProcessor.grammar.id);
            }
        }
    },

    stopRecording: {
        value: function () {
            if (this._recorder) {
                this._recorder.stop();
            }
        }
    },

    recognizerReady: {
        value: function() {
            this.updateStatus('Recognizer ready');
        }
    },

    feedGrammar: {
        value: function(g, id) {
            if (id) {
                g.id = id.id;
                this.recognizerReady();
            } else {
                this._postRecognizerJob({command: 'addGrammar', data: g.g},
                    function (id) {
                        this.feedGrammar(g, {id: id});
                    }.bind(this));
            }
        }
    },

    feedWords: {
        value: function(words) {
            this._postRecognizerJob({command: 'addWords', data: words},
                function () {
                    this.feedGrammar(CommandProcessor.grammar, 0);
                }.bind(this));
        }
    },

    _initRecognizer: {
        value: function() {
            this._postRecognizerJob({command: 'initialize'},
                function() {
                    if (this._recorder) {
                        this._recorder.consumers = [this._voiceRecognizer];
                    }
                    this.feedWords(CommandProcessor.wordList);
                }.bind(this)
            );
        }
    }
});
