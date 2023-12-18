import {
  preprocessCores,
  getEdgesFromTriangulation,
  filterEdgesByAngle,
  filterEdgesByLength,
  limitConnections,
  determineImageRotation,
  calculateGridWidth,
  calculateAverageDistance,
  sortEdgesAndAddIsolatedPoints,
  visualizeSortedRows,
  traveling_algorithm,
  
} from "./delaunay_triangulation.js";

function getHyperparametersFromUI() {
  // Collect hyperparameter values from the UI
  const thresholdMultiplier = parseFloat(
    document.getElementById("thresholdMultiplier").value
  );
  const thresholdAngle = parseFloat(
    document.getElementById("thresholdAngle").value
  );
  const originAngle = parseFloat(document.getElementById("originAngle").value);
  const radiusMultiplier = parseFloat(
    document.getElementById("radiusMultiplier").value
  );
  
  const minAngle = parseFloat(document.getElementById("minAngle").value);
  const maxAngle = parseFloat(document.getElementById("maxAngle").value);
  const angleStepSize = parseFloat(
    document.getElementById("angleStepSize").value
  );
  const angleThreshold = parseFloat(
    document.getElementById("angleThreshold").value
  );
  const multiplier = parseFloat(document.getElementById("multiplier").value);
  const searchAngle = parseFloat(document.getElementById("searchAngle").value);
  const gamma = parseFloat(document.getElementById("gamma").value);
  const gridWidth = parseFloat(document.getElementById("gridWidth").value);
  const imageWidth = parseFloat(document.getElementById("imageWidth").value);

  return {
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
    imageWidth,
  };
}

// Function to handle loading JSON from URL parameter
async function loadJSONFromURL(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Error loading JSON from URL:", error);
    return null;
  }
}

// Function to initiate the pipeline with data from the URL
async function initFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const fileURL = urlParams.get("json"); // Assuming the URL parameter is named 'json'

  if (fileURL) {
    const jsonData = await loadJSONFromURL(fileURL);
    window.cores = preprocessCores(jsonData);


    if (jsonData) {
      // Assuming you have a function to setup UI values or something similar
     await loadDataAndDetermineParams(window.cores, getHyperparametersFromUI());

      applyAndVisualize();
    }
  }
}

// Call initFromURL when the window loads
window.addEventListener("load", initFromURL);

document.getElementById("loadJsonBtn").addEventListener("click", async () => {
  const jsonUrl = document.getElementById("jsonUrlInput").value;
  let jsonData = null;
  try {
    jsonData = await loadJSONFromURL(jsonUrl);
  } catch (error) {
    console.error("Error loading JSON from URL:", error);
    return null;
  }
  window.cores = preprocessCores(jsonData);
  await loadDataAndDetermineParams(window.cores, getHyperparametersFromUI());

  applyAndVisualize();

  // Update the URL with the loaded JSON
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}?json=${jsonUrl}`
  );
});

function handleFileLoad(event) {
  try {
    // Parse the uploaded file and preprocess the cores
    window.cores = preprocessCores(JSON.parse(event.target.result));

    loadDataAndDetermineParams(window.cores, getHyperparametersFromUI());
  } catch (error) {
    console.error("Error processing file:", error);
  }
}

function handleFileSelect(event) {
  const reader = new FileReader();
  reader.onload = handleFileLoad; // Set the event handler for when the file is read
  reader.readAsText(event.target.files[0]); // Read the selected file as text
}

document
  .getElementById("fileInput")
  .addEventListener("change", handleFileSelect, false); // Attach the event listener to the file input

// Event listener for the Apply Hyperparameters button
document
  .getElementById("apply-hyperparameters")
  .addEventListener("click", applyAndVisualize);

async function applyAndVisualize() {
  // Collect hyperparameter values from the UI

  if (window.cores) {
    // Process and visualize with new hyperparameters
    runTravelingAlgorithm(window.cores, getHyperparametersFromUI());
  } else {
    console.error("No cores data available. Please load a file first.");
  }
}

function rotatePoint(point, angle) {
  const x = point[0];
  const y = point[1];
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const newX = x * cos - y * sin;
  const newY = x * sin + y * cos;
  return [newX, newY];
}

async function runTravelingAlgorithm(normalizedCores, params) {
  const delaunayTriangleEdges = getEdgesFromTriangulation(normalizedCores);
  const lengthFilteredEdges = filterEdgesByLength(
    delaunayTriangleEdges,
    normalizedCores,
    params.thresholdMultiplier
  );

  let bestEdgeSet = filterEdgesByAngle(lengthFilteredEdges, normalizedCores, params.thresholdAngle, params.originAngle)
  bestEdgeSet = limitConnections(bestEdgeSet, normalizedCores);
  bestEdgeSet = sortEdgesAndAddIsolatedPoints(bestEdgeSet, normalizedCores);

  let coordinatesInput = bestEdgeSet.map(([start, end]) => {
    return [
      [normalizedCores[start].x, normalizedCores[start].y],
      [normalizedCores[end].x, normalizedCores[end].y],
    ];
  });

  let rows = traveling_algorithm(
    coordinatesInput,
    params.imageWidth,
    params.gridWidth,
    params.gamma,
    params.searchAngle,
    params.originAngle,
    params.radiusMultiplier
  );

  // Temporarily rotate the first point of each row for sorting purposes
  let sortingHelper = rows.map(row => {
    return {
      originalRow: row,
      rotatedPoint: rotatePoint(row[0]["point"], -params.originAngle)
    };
  });

  // Sort the rows based on the y-coordinate of the rotated first point in each row
  sortingHelper.sort((a, b) => a.rotatedPoint[1] - b.rotatedPoint[1]);

  // Extract the original rows in sorted order
  let sortedRows = sortingHelper.map(item => item.originalRow);

  visualizeSortedRows(sortedRows, "visualization", window.preprocessingData.minX, window.preprocessingData.minY);
}


// Updated function to accept hyperparameters and cores data
async function loadDataAndDetermineParams(normalizedCores, params) {
  const delaunayTriangleEdges = getEdgesFromTriangulation(normalizedCores);
  const lengthFilteredEdges = filterEdgesByLength(
    delaunayTriangleEdges,
    normalizedCores,
    params.thresholdMultiplier
  );

  const [bestEdgeSet, bestEdgeSetLength, originAngle] =
    await determineImageRotation(
      cores,
      lengthFilteredEdges,
      params.minAngle,
      params.maxAngle,
      params.angleStepSize,
      params.angleThreshold
    );

  let coordinatesInput = bestEdgeSet.map(([start, end]) => {
    return [
      [cores[start].x, cores[start].y],
      [cores[end].x, cores[end].y],
    ];
  });

  // Calculate the average distance and the image width
  const d = calculateAverageDistance(coordinatesInput);
  const imageWidth = calculateGridWidth(normalizedCores, d, params.multiplier);

  // Update the form values with the new calculations
  document.getElementById("originAngle").value = originAngle.toFixed(2);
  document.getElementById("gridWidth").value = d.toFixed(2);
  document.getElementById("imageWidth").value = imageWidth.toFixed(2);
  document.getElementById("gamma").value = (0.9 * d).toFixed(2);

  // Update the params object with the new calculations
  params.originAngle = originAngle;
  params.gridWidth = d;
  params.imageWidth = imageWidth;
  params.gamma = 0.9 * d;
}

function saveUpdatedCores() {
  if (!window.finalCores) {
    alert("No data available to save.");
    return;
  }
  

  // Download the updated cores data as a JSON file

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.finalCores));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "updated_cores.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}


document.getElementById("saveResults").addEventListener("click", saveUpdatedCores);


document.getElementById('toggle-advanced-settings').addEventListener('click', function() {
  var advancedSettings = document.getElementById('advanced-settings');
  if (advancedSettings.style.display === 'none') {
      advancedSettings.style.display = 'block';
      this.textContent = 'Hide Advanced Settings';
  } else {
      advancedSettings.style.display = 'none';
      this.textContent = 'Show Advanced Settings';
  }
});
