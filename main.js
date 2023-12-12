import {

    preprocessCores,
    getEdgesFromTriangulation,
    filterEdgesByAngle,
    filterEdgesByLength,
    limitConnections,
    determineImageRotation,
    calculateGridWidth,
    calculateAverageDistance,
    visualizeSortedRows,
    traveling_algorithm

} from './delaunay_triangulation.js';

function handleFileLoad(event) {
    try {
        // Parse the uploaded file and preprocess the cores
        window.cores = preprocessCores(JSON.parse(event.target.result));
        
        // Collect hyperparameter values from the UI
        const thresholdMultiplier = parseFloat(document.getElementById('thresholdMultiplier').value);
        const thresholdAngle = parseFloat(document.getElementById('thresholdAngle').value);
        const originAngle = parseFloat(document.getElementById('originAngle').value);
        const radiusMultiplier = parseFloat(document.getElementById('radiusMultiplier').value);
        const minAngle = parseFloat(document.getElementById('minAngle').value);
        const maxAngle = parseFloat(document.getElementById('maxAngle').value);
        const angleStepSize = parseFloat(document.getElementById('angleStepSize').value);
        const angleThreshold = parseFloat(document.getElementById('angleThreshold').value);
        const multiplier = parseFloat(document.getElementById('multiplier').value);
        const searchAngle = parseFloat(document.getElementById('searchAngle').value);
        const gamma = parseFloat(document.getElementById('gamma').value);
        const gridWidth = parseFloat(document.getElementById('gridWidth').value);
        const imageWidth = parseFloat(document.getElementById('imageWidth').value);
        
        loadDataAndDetermineParams(window.cores, {
            thresholdMultiplier,
            thresholdAngle,
            originAngle,
            radiusMultiplier,
            minAngle,
            maxAngle,
            angleStepSize,
            angleThreshold,
            multiplier,
            searchAngle,
            gamma,
            gridWidth,
            imageWidth
        });

    } catch (error) {
        console.error('Error processing file:', error);
    }
}

function handleFileSelect(event) {
    const reader = new FileReader();
    reader.onload = handleFileLoad; // Set the event handler for when the file is read
    reader.readAsText(event.target.files[0]); // Read the selected file as text
}

document.getElementById('fileInput').addEventListener('change', handleFileSelect, false); // Attach the event listener to the file input


// Event listener for the Apply Hyperparameters button
document.getElementById('apply-hyperparameters').addEventListener('click', applyAndVisualize);

function applyAndVisualize() {
    // Collect hyperparameter values from the UI
    const thresholdMultiplier = parseFloat(document.getElementById('thresholdMultiplier').value);
    const thresholdAngle = parseFloat(document.getElementById('thresholdAngle').value);
    const originAngle = parseFloat(document.getElementById('originAngle').value);
    const radiusMultiplier = parseFloat(document.getElementById('radiusMultiplier').value);
    const minAngle = parseFloat(document.getElementById('minAngle').value);
    const maxAngle = parseFloat(document.getElementById('maxAngle').value);
    const angleStepSize = parseFloat(document.getElementById('angleStepSize').value);
    const angleThreshold = parseFloat(document.getElementById('angleThreshold').value);
    const multiplier = parseFloat(document.getElementById('multiplier').value);
    const searchAngle = parseFloat(document.getElementById('searchAngle').value);
    const gamma = parseFloat(document.getElementById('gamma').value);
    const gridWidth = parseFloat(document.getElementById('gridWidth').value);
    const imageWidth = parseFloat(document.getElementById('imageWidth').value);

    if (window.cores) {
        // Process and visualize with new hyperparameters
        runTravelingAlgorithm(window.cores, {
            thresholdMultiplier,
            thresholdAngle,
            originAngle,
            radiusMultiplier,
            minAngle,
            maxAngle,
            angleStepSize,
            angleThreshold,
            multiplier,
            searchAngle,
            gamma,
            gridWidth,
            imageWidth
        });

    } else {
        console.error('No cores data available. Please load a file first.');
    }
}


async function runTravelingAlgorithm(cores, params) {

    const normalizedCores = preprocessCores(cores);
    const delaunayTriangleEdges = getEdgesFromTriangulation(normalizedCores);
    const lengthFilteredEdges = filterEdgesByLength(delaunayTriangleEdges, normalizedCores, params.thresholdMultiplier);

    const [bestEdgeSet, bestEdgeSetLength, originAngle] = await determineImageRotation(cores, lengthFilteredEdges, params.minAngle, params.maxAngle, params.angleStepSize, params.angleThreshold)

    let coordinatesInput = bestEdgeSet.map(([start, end]) => {
        return [[cores[start].x, cores[start].y], [cores[end].x, cores[end].y]];
    });

    let rows = traveling_algorithm(coordinatesInput, params.imageWidth, params.gridWidth, params.gamma, params.searchAngle, params.originAngle, params.radiusMultiplier);
    let sortedRows = rows.sort((a, b) => b[0]['point'][1] - a[0]['point'][1]);

    visualizeSortedRows(sortedRows, "visualization");

}

// Updated function to accept hyperparameters and cores data
async function loadDataAndDetermineParams(cores, params) {
    const normalizedCores = preprocessCores(cores);
    const delaunayTriangleEdges = getEdgesFromTriangulation(normalizedCores);
    const lengthFilteredEdges = filterEdgesByLength(delaunayTriangleEdges, normalizedCores, params.thresholdMultiplier);

    const [bestEdgeSet, bestEdgeSetLength, originAngle] = await determineImageRotation(cores, lengthFilteredEdges, params.minAngle, params.maxAngle, params.angleStepSize, params.angleThreshold)

    let coordinatesInput = bestEdgeSet.map(([start, end]) => {
        return [[cores[start].x, cores[start].y], [cores[end].x, cores[end].y]];
    });
    
    // Calculate the average distance and the image width
    const d = calculateAverageDistance(coordinatesInput);
    const imageWidth = calculateGridWidth(normalizedCores, d, params.multiplier);

    // Update the form values with the new calculations
    document.getElementById('originAngle').value = originAngle.toFixed(2); 
    document.getElementById('gridWidth').value = d.toFixed(2); 
    document.getElementById('imageWidth').value = imageWidth.toFixed(2); 
    document.getElementById('gamma').value = (0.75 * d).toFixed(2); 


    // Update the params object with the new calculations
    params.originAngle = originAngle;
    params.gridWidth = d;
    params.imageWidth = imageWidth;
    params.gamma = 0.75 * d;


    // let rows = traveling_algorithm(coordinatesInput, params.imageWidth, params.gridWidth, params.gamma, params.searchAngle, params.originAngle, params.radiusMultiplier);
    // let sortedRows = rows.sort((a, b) => b[0]['point'][1] - a[0]['point'][1]);

    // visualizeSortedRows(sortedRows, "visualization");
}
