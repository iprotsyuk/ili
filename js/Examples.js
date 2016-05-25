'use strict';

function updateGuiRecursively(gui) {
    for (var i in gui.__controllers) {
        gui.__controllers[i].updateDisplay();
    }
    for (var i in gui.__folders) {
        updateGuiRecursively(gui.__folders[i]);
    }
}

function Examples() {
    var examplesContainer = new dat.GUI({autoPlace: false});

    var folder = examplesContainer.addFolder('Examples');
    folder.open();

    var openExample = function() {
        g_workspace.download(this.files);

        if (this['adjustView'] !== undefined) {
            this.adjustView();
            updateGuiRecursively(g_gui);
        }
    };
    var items = [
        {
            name: 'Laptop',
            files: ['laptop/Air.stl', 'laptop/intensities.csv'],
            adjustView: function() {
                g_workspace.scene3d.adjustment.alpha = 0;
                g_workspace.scene3d.adjustment.beta = -160;
                g_workspace.scene3d.adjustment.gamma = 0;
                g_workspace.scene3d.adjustment.x = 7;
                g_workspace.scene3d.adjustment.y = 8;
                g_workspace.scene3d.adjustment.z = 3;

                g_workspace.scaleId = Workspace.Scale.LINEAR.id;
                g_workspace.colorMapId = 'VIRIDIS';
            }
        },
        {
            name: 'Human skin metabolome (female)',
            files: ['female/woman.stl', 'female/intensities.csv'],
            adjustView: function() {
                g_workspace.scene3d.adjustment.alpha = -90;
                g_workspace.scene3d.adjustment.beta = 0;
                g_workspace.scene3d.adjustment.gamma = 35;
                g_workspace.scene3d.adjustment.x = -3;
                g_workspace.scene3d.adjustment.y = -12;
                g_workspace.scene3d.adjustment.z = 10;

                g_workspace.scaleId = Workspace.Scale.LINEAR.id;
                g_workspace.colorMapId = 'JET';
            }
        },
        {
            name: 'Human skin metabolome (male)',
            files: ['male/man.stl', 'male/intensities.csv'],
            adjustView: function() {
                g_workspace.scene3d.adjustment.alpha = -90;
                g_workspace.scene3d.adjustment.beta = 0;
                g_workspace.scene3d.adjustment.gamma = 35;
                g_workspace.scene3d.adjustment.x = -6;
                g_workspace.scene3d.adjustment.y = -11;
                g_workspace.scene3d.adjustment.z = 15;

                g_workspace.scaleId = Workspace.Scale.LINEAR.id;
                g_workspace.colorMapId = 'JET';
            }
        },
        {
            name: 'Built environment',
            files: ['office/office.stl', 'office/intensities.csv'],
            adjustView: function() {
                g_workspace.scene3d.adjustment.alpha = -180;
                g_workspace.scene3d.adjustment.beta = -20;
                g_workspace.scene3d.adjustment.gamma = 0;
                g_workspace.scene3d.adjustment.x = -0.2;
                g_workspace.scene3d.adjustment.y = 19;
                g_workspace.scene3d.adjustment.z = 28.2;

                g_workspace.scaleId = Workspace.Scale.LINEAR.id;
                g_workspace.colorMapId = 'VIRIDIS';
            }
        }
    ];

    items.forEach(function(item) {
        item[item.name] = openExample.bind(item);
        folder.add(item, item.name);
    });

    var container = document.getElementById('examples-container');
    container.appendChild(examplesContainer.domElement);
};
