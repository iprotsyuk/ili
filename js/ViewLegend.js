'use strict';

function ViewLegend(model, svg) {
    this._model = model;
    this._svg = svg;
    this.updateColorMap();
}

ViewLegend.prototype = Object.create(null, {
    prepareUpdateLayout: {
        value: function() {}
    },

    finishUpdateLayout: {
        value: function() {}
    },

    updateColorMap: {
        value: function() {
            var description = this._model.colorMap.gradient;
            var stops = [];
            for (var i in description) {
                stops.push('<stop offset="' + i + '" style="stop-color:' +
                           description[i] + '" />');
            }
            this._svg.getElementById('colorMapGradient').innerHTML =
                    stops.join('');
        }
    }
});