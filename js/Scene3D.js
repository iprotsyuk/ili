function Scene3D() {
    EventSource.call(this, Scene3D.Events);

    this._scene = new THREE.Scene();
    this._frontLight = new THREE.PointLight(0xffffff, 1.5, 0);
    this._mesh = null;
    this._meshContainer = new THREE.Object3D();
    this._color = new THREE.Color('#575757');
    this._backgroundColor = new THREE.Color('black');
    this._meshMaterial = new THREE.MeshLambertMaterial({
        vertexColors: THREE.VertexColors,
        transparent: true,
        opacity: 0.9,
        shininess: 3,
        shading: THREE.SmoothShading
    });

    this._vrLegend = new THREE.Mesh(new THREE.PlaneGeometry(5, 2, 1, 1), new THREE.MeshBasicMaterial());

    this._vrEnabled = false;
    var fullScreenEventName = navigator.userAgent.toLowerCase().indexOf('firefox') > -1 ? 'mozfullscreenchange' : 'webkitfullscreenchange';
    document.addEventListener(fullScreenEventName, this.onFullscreenChange.bind(this), false);

    this._spotBorder = 0.05;
    this._colorMap = null;
    this._adjustment = {x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: 0};
    this._autorotation = 0;

    this._spots = null;
    this._mapping = null;

//    this._scene.add(new THREE.AxisHelper(20));
    this._scene.add(this._meshContainer);
    this._scene.add(this._frontLight);

    document.addEventListener('keypress', this.onKeyPress.bind(this), false);
};

Scene3D._makeLightProperty = function(field) {
    return Scene3D._makeProxyProperty(field, ['intensity'], function() {
    });
};

Scene3D._makeProxyProperty = function(field, properties, callback) {
    var proxy;
    return {
        get: function() {
            if (proxy) return proxy;
            proxy = {};
            for (var i = 0; i < properties.length; i++) {
                Object.defineProperty(proxy, properties[i], {
                    get: function(prop) {
                        return this[field][prop]
                    }.bind(this, properties[i]),

                    set: function(prop, value) {
                        this[field][prop] = value;
                        callback.call(this);
                    }.bind(this, properties[i])
                });
            }
            return proxy;
        },

        set: function(value) {
            for (var i = 0; i < properties.length; i++) {
                var prop = properties[i]
                this[field][prop] = value[prop];
            }
            callback.call(this);
        }
    }
};

Scene3D.prototype = Object.create(EventSource.prototype, {
    clone: {
        value: function(eventName, listener) {
            var result = new Scene3D();
            result.frontLight = this.frontLight;
            result.color = this.color;
            result.backgroundColor = this.backgroundColor;
            result.spotBorder = this.spotBorder;
            result.colorMap = this.colorMap;
            result.adjustment = this.adjustment;
            var geometry = new THREE.BufferGeometry();
            for (var i in this.geometry.attributes) {
                var a = this.geometry.attributes[i];
                geometry.addAttribute(i, new THREE.BufferAttribute(a.array, a.itemSize));
            }
            result.geometry = geometry;
            result.spots = this.spots;
            result.mapping = this.mapping;
            return result;
        }
    },

    frontLight: Scene3D._makeLightProperty('_frontLight'),

    color: {
        get: function() {
            return '#' + this._color.getHexString();
        },

        set: function(value) {
            var color = new THREE.Color(value);
            if (color.equals(this._color)) return;
            this._color.set(color);
            if (this._mesh) {
                this._recolor();
            }
        }
    },

    onFullscreenChange: {
        value: function(event) {
            this._vrEnabled = document.mozFullScreenElement !== null && document.mozFullScreenElement !== undefined
                || document.webkitFullscreenElement !== null && document.webkitFullscreenElement !== undefined;
            if (this._vrEnabled) {
                this.updateVrLegend();
            }
        }
    },

    updateVrLegend: {
        value: function () {
            // convert legend from svg to png
            // Source: https://gist.github.com/gustavohenke/9073132
            var legend = document.querySelector("svg.ViewLegend");
            var legendStyle = window.getComputedStyle(legend);
            // these two attributes below have to be specified explicitly in Firefox
            var legendWidth = parseInt(legendStyle.getPropertyValue('width'), 10);
            var legendHeight = parseInt(legendStyle.getPropertyValue('height'), 10);
            legend.setAttribute('width', legendWidth);
            legend.setAttribute('height', legendHeight);
            var svgData = (new XMLSerializer()).serializeToString(legend);

            var canvas = document.createElement("canvas");
            canvas.width = legendWidth;
            canvas.height = legendHeight;
            var ctx = canvas.getContext("2d");

            var img = document.createElement("img");
            img.setAttribute("src", "data:image/svg+xml;base64," + window.btoa(svgData));

            img.onload = function () {
                ctx.drawImage(img, 0, 0);

                var texture = new THREE.Texture(canvas);
                texture.needsUpdate = true;
                texture.minFilter = THREE.LinearFilter;

                var vrLegendMaterial = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 0.8
                });
                this._vrLegend.material = vrLegendMaterial;
            }.bind(this);
        }
    },

    backgroundColor: {
        get: function() {
            return '#' + this._backgroundColor.getHexString();
        },

        set: function(value) {
            var color = new THREE.Color(value);
            if (color.equals(this._backgroundColor)) return;
            this._backgroundColor.set(color);
        }
    },

    backgroundColorValue: {
        get: function() {
            return this._backgroundColor;
        }
    },

    spotBorder: {
        get: function() {
            return this._spotBorder;
        },

        set: function(value) {
            if (this._spotBorder == value) return;
            if (value < 0.0) value = 0.0;
            if (value > 1.0) value = 1.0;
            this._spotBorder = value;
            if (this._mesh) {
                this._recolor();
            }
        }
    },

    adjustment: Scene3D._makeProxyProperty('_adjustment', ['x', 'y', 'z', 'alpha', 'beta', 'gamma'],
            function() {
        if (this._mesh) {
            this._applyAdjustment();
        }
    }),

    onKeyPress: {
        value: function(event) {
            if (event.key == 'r') {
                event.preventDefault();
                event.stopPropagation();

                if (this._autorotation != 0) {
                    this._autorotation = 0;
                } else {
                    this._autorotation = event.ctrlKey ? -1 : 1;
                }
            }
        }
    },

    spots: {
        get: function() {
            return this._spots;
        },

        set: function(value) {
            if (value) {
                this._spots = new Array(value.length);
                for (var i = 0; i < value.length; i++) {
                    this._spots[i] = {
                        x: value[i].x,
                        y: value[i].y,
                        z: value[i].z,
                        r: value[i].r,
                        intensity: value[i].intensity,
                        color: new THREE.Color(),
                        name: value[i].name,
                    };
                }
            } else {
                this._spots = null;
            }
            if (this._mapping) {
                this._mapping = null; // Mapping is obsolete.

                if (this._mesh) {
                    this._recolor();
                    if (this._vrEnabled) {
                        this.updateVrLegend();
                    }
                }
            }
        }
    },

    updateIntensities: {
        value: function(spots) {
            if (!this._spots) return;

            for (var i = 0; i < this._spots.length; i++) {
                this._spots[i].intensity = spots[i].intensity;
            }
            if (this._mesh && this._mapping) {
                this._recolor();
                if (this._vrEnabled) {
                    this.updateVrLegend();
                }
            }
        }
    },

    mapping: {
        get: function() {
            return this._mapping;
        },

        set: function(value) {
            if (!this._spots) throw "Mapping doesn't make sense without spots";
            this._mapping = value;
            if (this._mesh) {
                this._recolor();
            }
        }
    },

    geometry: {
        get: function() {
            return this._mesh ? this._mesh.geometry : null;
        },

        set: function(geometry) {
            if (!this._mesh && !geometry) {
                return;
            }
            if (this._mesh) {
                this._meshContainer.remove(this._mesh);
            }
            this._mapping = null;
            if (geometry) {
                geometry.computeBoundingBox();
                this._mesh = new THREE.Mesh(geometry, this._meshMaterial);
                this._mesh.position.copy(geometry.boundingBox.center().negate());
                this._meshContainer.add(this._mesh);
                this._applyAdjustment();
                this._recolor();
                this._meshContainer.add(this._mesh);
            } else {
                this._mesh = null;
            }
        }
    },

    colorMap: {
        get: function() {
            return this._colorMap;
        },

        set: function(value) {
            this._colorMap = value;
            if (this._mesh && this._spots && this._mapping) {
                this._recolor();
                if (this._vrEnabled) {
                    this.updateVrLegend();
                }
            }
        }
    },

    position: {
        get: function() {
            return this._scene.position.clone();
        }
    },

    render: {
        value: function(renderer, camera) {
            this._meshContainer.rotation.z += this._autorotation * 0.005;
            this.updateVrLegendPosition(camera);

            this._frontLight.position.set(camera.position.x, camera.position.y, camera.position.z);
            renderer.render(this._scene, camera);
        }
    },

    updateVrLegendPosition: {
        value: function(camera) {
            if (this._vrEnabled && camera.children.indexOf(this._vrLegend) == -1) {
                camera.add(this._vrLegend);
                this._vrLegend.position.set(-1, -2, -5);
                this._vrLegend.rotation.x = -0.5;
                this._vrLegend.rotation.y = 0.5;
            } else if (!this._vrEnabled && camera.children.indexOf(this._vrLegend) != -1) {
                camera.remove(this._vrLegend);
            }
        }
    },

    raycast: {
        value: function(raycaster) {
            if (!this._mesh || !this._spots || !this._mapping) return null;
            var message = {
                positions: this._mesh.geometry.attributes.position.array,
                origin: new THREE.Vector3().copy(raycaster.ray.origin),
                direction: new THREE.Vector3().copy(raycaster.ray.direction),
                matrixWorld: new THREE.Matrix4().copy(this._mesh.matrixWorld),
            };
            var closestSpotIndeces = this._mapping.closestSpotIndeces;
            var spots = this._spots;
            var worker = new Worker('js/workers/Raycaster.js');

            var promise = new Promise(function(accept, reject) {
                worker.onmessage = function(event) {
                    worker.terminate();
                    var face = event.data;
                    var spotIndex = -1;
                    for (var i in (face || {})) {
                        if (closestSpotIndeces[face[i]] >= 0) {
                            spotIndex = closestSpotIndeces[face[i]];
                            break;
                        }
                    }
                    accept(spots[spotIndex]);
                };
                worker.onerror = function(event) {
                    console.log('Reycasting failed', event);
                    worker.terminate();
                    reject();
                };
                worker.postMessage(message);
            });

            Object.defineProperty(promise, 'cancel', {
                value: function() {
                    worker.terminate();
                }
            });

            return promise;
        }
    },

    spotToWorld: {
        value: function(spot) {
            if (!this._mesh) return null;

            var position = new THREE.Vector3(spot.x, spot.y, spot.z);
            position.applyMatrix4(this._mesh.matrixWorld);
            return position;
        }
    },

    _recolor: {
        value: function() {
            var startTime = new Date();
            var geometry = this.geometry;
            var mapping = this.mapping;
            var spots = this.spots;

            var position = geometry.getAttribute('position');
            var positionCount = position.array.length / position.itemSize;

            if (mapping) {
                for (var i = 0; i < spots.length; i++) {
                    if (!isNaN(spots[i].intensity)) {
                        this._colorMap.map(spots[i].color, spots[i].intensity);
                    }
                }
            }

            if (!geometry.getAttribute('color')) {
                geometry.addAttribute('color', new THREE.BufferAttribute(
                        new Float32Array(positionCount * 3), 3));
            }
            var color = geometry.getAttribute('color').array;

            // Fill |color| with this._color.
            if (positionCount) {
                var CHUNK_SIZE = 64;
                var last = 0;
                if (positionCount > CHUNK_SIZE) {
                    for (var i = 0; i < CHUNK_SIZE; i++) {
                        this._color.toArray(color, i * 3);
                    }
                    var chunk = new Float32Array(color.buffer, 0, CHUNK_SIZE * 3);
                    for (var i = CHUNK_SIZE; i <= positionCount - CHUNK_SIZE; last = i, i+= CHUNK_SIZE) {
                        color.set(chunk, i * 3);
                    }
                }
                for (var i = last; i < positionCount; i++) {
                    this._color.toArray(color, i * 3);
                }
            }

            if (mapping) {
                var spotBorder = 1.0 - this._spotBorder;
                var closestSpotIndeces = mapping.closestSpotIndeces;
                var closestSpotDistances = mapping.closestSpotDistances;
                for (var i = 0; i < positionCount; i++) {
                    var index = closestSpotIndeces[i];
                    if (index >= 0) {
                        var spot = spots[index];
                        if (!isNaN(spot.intensity)) {
                            var alpha = 1.0 - spotBorder * closestSpotDistances[i];
                            var base = i * 3;
                            color[base + 0] += (spot.color.r - color[base + 0]) * alpha;
                            color[base + 1] += (spot.color.g - color[base + 1]) * alpha;
                            color[base + 2] += (spot.color.b - color[base + 2]) * alpha;
                        }
                    }
                }
            }

            geometry.getAttribute('color').needsUpdate = true;

            var endTime = new Date();
            console.log('Recoloring time: ' +
                    (endTime.valueOf() - startTime.valueOf()) / 1000);
        }
    },

    _applyAdjustment: {
        value: function() {
            this._meshContainer.rotation.x = this._adjustment.alpha * Math.PI / 180;
            this._meshContainer.rotation.y = this._adjustment.beta * Math.PI / 180;
            this._meshContainer.rotation.z = this._adjustment.gamma * Math.PI / 180;
            this._meshContainer.position.copy(this._adjustment);
            this._meshContainer.updateMatrix();
        }
    },
});
