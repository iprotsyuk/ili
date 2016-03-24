'use strict';

function CommandProcessor(object, target) {
    this._object = object;
    this._target = target;

    this._lastHyp = [];
    this._isActive = false;

    this._lastCommandHandler = null;
    this._lastCommandPersists = false;

    this._rotationAngleStep = 0.01;
    this._zoomStep = 0.01;

    this._transitionDictionary = {};
    for (var i = 0; i < CommandProcessor.grammar.g.transitions.length; ++i) {
        var currentWord = CommandProcessor.grammar.g.transitions[i].word;
        this._transitionDictionary[currentWord] = {
            from: CommandProcessor.grammar.g.transitions[i].from,
            to: CommandProcessor.grammar.g.transitions[i].to
        };
    }
}

CommandProcessor.prototype = Object.create(null, {
    updateObjectPosition: {
        value: function() {
            if (this._lastCommandHandler !== null) {
                this._lastCommandHandler();

                if (!this._lastCommandPersists) {
                    this._lastCommandHandler = null;
                }
            }
        }
    },

    reset: {
        value: function() {
            this._lastHyp = [];
        }
    },

    updateHypothesis: {
        value: function(newHyp) {
            var updateStartTime = new Date().valueOf();

            this._updateHypothesis(newHyp);

            console.log('Voice command handling took ' + (new Date().valueOf() - updateStartTime) / 1000);
        }
    },

    _updateHypothesis: {
        value: function(newHyp) {
            var fullHypStr = this._segmentsToString(newHyp);
            console.log('Full hypothesis: ' + fullHypStr);

            var updatedHypSegments = this._getUpdatedHypothesisPart(newHyp);

            var updatedCommandStr = this._segmentsToString(updatedHypSegments);
            console.log('Updated command part: ' + updatedCommandStr);

            if (this._isCompleteCommand(updatedHypSegments)) {
                var currentCommandId = null;
                for (var commandId in CommandProcessor.Commands) {
                    if (this._phraseMatchesCommand(updatedCommandStr, commandId)) {
                        currentCommandId = commandId;
                        break;
                    }
                }
                if (currentCommandId == null) {
                    console.log('Error: unable to recognize last command');
                    return;
                }
                this._lastHyp = newHyp;

                if (!this.active && !CommandProcessor.Commands[currentCommandId].canActivate) {
                    return;
                }

                this._lastCommandPersists = CommandProcessor.Commands[currentCommandId].persists;
                this._lastCommandHandler = CommandProcessor.Commands[currentCommandId].handler.bind(this, updatedCommandStr);

                console.log('Recognized command: ' + updatedCommandStr);
            }
        }
    },

    _getUpdatedHypothesisPart: {
        value: function(newHyp) {
            if (this._lastHyp.length == 0) {
                return newHyp;
            }

            for (var i = newHyp.length - 1; i >= 0; --i) {
                var currentNewWord = newHyp[i];
                for (var j = this._lastHyp.length - 1; j >= 0; --j) {
                    var currentOldWord = this._lastHyp[j];
                    if (currentOldWord.start < currentNewWord.start) {
                        break;
                    } else if (currentNewWord.start == currentOldWord.start && currentNewWord.end == currentOldWord.end) {
                        return newHyp.slice(i + 1);
                    }
                }
            }
            return newHyp;
        }
    },

    _segmentsToString: {
        value: function(segs) {
            var words = [];
            for (var i = 0; i < segs.length; ++i) {
                if ('<sil>' !== segs[i].word) {
                    words.push(segs[i].word);
                }
            }
            return words.join(' ');
        }
    },

    _phraseMatchesCommand: {
        value: function(phrase, commandId) {
            if (!(commandId in CommandProcessor.Commands)) {
                console.log('Error: command "' + commandId + '" is not recognized.');
                return false;
            }

            var matcherId = CommandProcessor.Commands[commandId].match;
            var matcher = null;
            for (var matchMode in CommandProcessor.KeywordMatchingMode) {
                if (CommandProcessor.KeywordMatchingMode[matchMode].id === matcherId) {
                    matcher = CommandProcessor.KeywordMatchingMode[matchMode].matcher;
                }
            }

            if (matcher == null) {
                console.log('Error: command match mode "' + matcherId + '" is not recognized.');
                return false;
            } else {
                return matcher(phrase, commandId);
            }
        }
    },

    _isCompleteCommand: {
        value: function(phrase) {
            if (phrase.length === 0) {
                return false;
            }
            var lastWordIndex = phrase.length;
            var lastWord = '';
            do {
                lastWord = phrase[--lastWordIndex].word;
            } while (lastWord === '<sil>' && lastWordIndex > 0);
            return (lastWord in this._transitionDictionary) && this._transitionDictionary[lastWord].to === 0;
        }
    },

    active: {
        get: function() {
            return this._isActive;
        },
        set: function(val) {
            if (val === this._isActive) {
                return;
            }

            this._isActive = val;
            if (val) {
                console.log('Voice control activated');
                document.getElementById("voice-control-indicator").className = "vc-enabled";
            } else {
                console.log('Voice control deactivated');
                document.getElementById("voice-control-indicator").className = "vc-disabled";
            }
            window.setTimeout(function() {
                document.getElementById("voice-control-indicator").className = "vc-default";
            }, 700);
        }
    },

    lastCommandPersists: {
        get: function() {
            return this._lastCommandPersists;
        },
        set: function(val) {
            this._lastCommandPersists = val;
        }
    },

    object: {
        get: function() {
            return this._object;
        }
    },

    target: {
        get: function() {
            return this._target;
        }
    },

    rotationAngleStep: {
        get: function () {
            return this._rotationAngleStep;
        },
        set: function (val) {
            if (Number(val) === val) {
                this._rotationAngleStep = val;
            } else {
                console.log('Numeric parameter was expected. Got "' + val + '"');
            }
        }
    },

    zoomStep: {
        get: function () {
            return this._zoomStep;
        },
        set: function (val) {
            if (Number(val) === val) {
                this._zoomStep = val;
            } else {
                console.log('Numeric parameter was expected. Got "' + val + '"');
            }
        }
    },

    rotate: {
        value: function(axis, clockwise) {
            var radiusVector = new THREE.Vector3();
            radiusVector.copy(this.object.position);
            radiusVector.sub(this.target);
            radiusVector.applyAxisAngle(axis, this.rotationAngleStep * (clockwise? -1 : 1));

            this.object.position.copy(radiusVector);
            this.object.position.add(this.target);

            this.object.lookAt(this.target);
        }
    },

    zoom: {
        value: function(zoomIn) {
            var radiusVector = new THREE.Vector3();
            radiusVector.subVectors(this.object.position, this.target);
            radiusVector.multiplyScalar(1 + (zoomIn ? -this.zoomStep: this.zoomStep));
            radiusVector.add(this.target);
            this.object.position.copy(radiusVector);
        }
    }
});

CommandProcessor.wordList = [['ALOHA', 'AH L OW HH AA'], ['MAHALO', 'M AH HH AA L OW'],
    ['STOP', 'S T AA P'], ['FREEZE', 'F R IY Z'],
    ['ROTATE', 'R OW T EY T'], ['SPIN', 'S P IH N'],
    ['ZOOM', 'Z UW M'],
    ['IN', 'IH N'], ['OUT', 'AW T'],
    ['NEXT', 'N EH K S T'], ['PREVIOUS', 'P R IY V IY AH S']];

CommandProcessor.grammar = {
    title: 'VoiceControl',
    g: {
        numStates: 2,
        start: 0,
        end: 1,
        transitions: [
            {from: 0, to: 0, word: 'ALOHA'},
            {from: 0, to: 0, word: 'MAHALO'},

            {from: 0, to: 0, word: 'STOP'},
            {from: 0, to: 0, word: 'FREEZE'},

            {from: 0, to: 0, word: 'ROTATE'},
            {from: 0, to: 0, word: 'SPIN'},

            {from: 0, to: 1, word: 'ZOOM'},
            {from: 1, to: 0, word: 'IN'},
            {from: 1, to: 0, word: 'OUT'},

            {from: 0, to: 0, word: 'NEXT'},
            {from: 0, to: 0, word: 'PREVIOUS'}
        ]}
};

CommandProcessor.KeywordMatchingMode = {
    Exact: {
        id: 'exact',
        matcher: function(phrase, commandId) {
            var keywords = CommandProcessor.Commands[commandId].keywords;
            for (var i = 0; i < keywords.length; ++i) {
                var currentWord = keywords[i];
                if (phrase.indexOf(currentWord, phrase.length - currentWord.length) !== -1) {
                    return true;
                }
            }
            return false;
        }
    },
    Contains: {
        id: 'contains',
        matcher: function(phrase, commandId) {
            var keywords = CommandProcessor.Commands[commandId].keywords;
            for (var i = 0; i < keywords.length; ++i) {
                if (phrase.indexOf(keywords[i]) > -1) {
                    return true;
                }
            }
            return false;
        }
    }
};

CommandProcessor.Commands = {
    ACTIVATE: {
        keywords: ['ALOHA'],
        match: CommandProcessor.KeywordMatchingMode.Exact.id,
        canActivate: true,
        persists: false,
        handler: function(command) {
            this.active = true;
        }
    },
    DEACTIVATE: {
        keywords: ['MAHALO'],
        match: CommandProcessor.KeywordMatchingMode.Exact.id,
        canActivate: false,
        persists: false,
        handler: function(command) {
            this.active = false;
        }
    },
    STOP: {
        keywords: ['STOP', 'FREEZE'],
        match: CommandProcessor.KeywordMatchingMode.Exact.id,
        canActivate: false,
        persists: false,
        handler: function(command) {
            this.lastCommandPersists = false;
        }
    },
    ROTATE: {
        keywords: ['ROTATE', 'SPIN'],
        match: CommandProcessor.KeywordMatchingMode.Exact.id,
        canActivate: false,
        persists: true,
        handler: function(command) {
            this.rotate(this.object.up, true);
        }
    },
    ZOOM: {
        keywords: ['ZOOM'],
        match: CommandProcessor.KeywordMatchingMode.Contains.id,
        canActivate: false,
        persists: true,
        handler: function(command) {
            var zoomIn = null;
            if (command.indexOf('IN') > -1) {
                zoomIn = true;
            } else if (command.indexOf('OUT') > -1) {
                zoomIn = false;
            } else {
                console.log('Error: Direction of zooming is not specified. Falling back on zooming in');
                zoomIn = true;
            }
            this.zoom(zoomIn);
        }
    },
    NEXT: {
        keywords: ['NEXT'],
        match: CommandProcessor.KeywordMatchingMode.Exact.id,
        canActivate: false,
        persists: false,
        handler: function(command) {
            g_mapSelector.blink();
            g_mapSelector.navigate(MapSelector.Direction.DOWN);
        }
    },
    PREVIOUS: {
        keywords: ['PREVIOUS'],
        match: CommandProcessor.KeywordMatchingMode.Exact.id,
        canActivate: false,
        persists: false,
        handler: function(command) {
            g_mapSelector.blink();
            g_mapSelector.navigate(MapSelector.Direction.UP);
        }
    }
};
