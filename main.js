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
      loadDataAndDetermineParams(window.cores, getHyperparametersFromUI());
      runTravelingAlgorithm(window.cores, getHyperparametersFromUI());
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

  applyAndVisualize();
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

function applyAndVisualize() {
  // Collect hyperparameter values from the UI

  if (window.cores) {
    // Process and visualize with new hyperparameters
    runTravelingAlgorithm(window.cores, getHyperparametersFromUI());
  } else {
    console.error("No cores data available. Please load a file first.");
  }
}

async function runTravelingAlgorithm(normalizedCores, params) {
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

  let rows = traveling_algorithm(
    coordinatesInput,
    params.imageWidth,
    params.gridWidth,
    params.gamma,
    params.searchAngle,
    params.originAngle,
    params.radiusMultiplier
  );
  let sortedRows = rows.sort((a, b) => b[0]["point"][1] - a[0]["point"][1]);

  rows.forEach((row, rowIndex) => {
    row.forEach((pointInfo, colIndex) => {
      const coreIndex = pointInfo.index;
      if (coreIndex >= 0) {
        window.cores[coreIndex].row = rowIndex;
        window.cores[coreIndex].col = colIndex;
        window.cores[coreIndex].isImaginary = pointInfo.isImaginary;
      }
    });
  });

  visualizeSortedRows(sortedRows, "visualization", window.preprocessingData.minX, window.preprocessingData.minY);
}

// Updated function to accept hyperparameters and cores data
async function loadDataAndDetermineParams(cores, params) {
  const normalizedCores = preprocessCores(cores);
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
  document.getElementById("gamma").value = (0.75 * d).toFixed(2);

  // Update the params object with the new calculations
  params.originAngle = originAngle;
  params.gridWidth = d;
  params.imageWidth = imageWidth;
  params.gamma = 0.75 * d;
}

function saveUpdatedCores() {
  if (!window.cores) {
    alert("No data available to save.");
    return;
  }
  
  let savedCores = [...window.cores]
  // Add the minX and minY values to the cores data, ensuring not to change the original data
  savedCores.forEach(core => {
    core.x = core.x + window.preprocessingData.minX;
    core.y = core.y + window.preprocessingData.minY;
  });

  
  // Download the updated cores data as a JSON file

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedCores));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "updated_cores.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}


document.getElementById("saveResults").addEventListener("click", saveUpdatedCores);

