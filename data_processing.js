import {
  getEdgesFromTriangulation,
  filterEdgesByAngle,
  filterEdgesByLength,
  limitConnections,
  determineImageRotation,
  calculateGridWidth,
  calculateAverageDistance,
  sortEdgesAndAddIsolatedPoints,
  traveling_algorithm,
} from "./delaunay_triangulation.js";

import { applyAndVisualizeTravelingAlgorithm } from "./drawCanvas.js";

import { getHyperparametersFromUI } from "./UI.js";

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

async function preprocessForTravelingAlgorithm() {
  await loadDataAndDetermineParams(
    window.preprocessedCores,
    getHyperparametersFromUI()
  );

  applyAndVisualizeTravelingAlgorithm();
}

// Function to calculate the median x coordinate of the first column
function calculateMedianX(sortedRows, originAngle) {

  // Extract the x coordinate of the first column from each row
  let firstColumnXValues = sortedRows.map((row) => rotatePoint(row[0].point, -originAngle)[0]);
  firstColumnXValues.sort((a, b) => a - b);
  let middleIndex = Math.floor(firstColumnXValues.length / 2);
  // Calculate median
  if (firstColumnXValues.length % 2) {
    return firstColumnXValues[middleIndex];
  } else {
    return (
      (firstColumnXValues[middleIndex - 1] + firstColumnXValues[middleIndex]) /
      2.0
    );
  }
}

// Function to normalize rows by adding imaginary points
function normalizeRowsByAddingImaginaryPoints(
  sortedRows,
  medianX,
  gridWidth,
  originAngle,
  thresholdForImaginaryPoints = 0.6
) {

  return sortedRows.map((row, index) => {
    // Rotate first point to align with the x-axis
    let rotatedFirstPoint = rotatePoint(row[0].point, -originAngle);

    // Calculate the offset from the median
    let offsetX = rotatedFirstPoint[0] - medianX;

    // Determine the number of imaginary points to add
    let imaginaryPointsCount = Math.max(0, Math.floor((offsetX / gridWidth) + thresholdForImaginaryPoints));

    // Generate imaginary points
    let imaginaryPoints = [];
    for (let i = imaginaryPointsCount - 1; i >= 0; i--) {
      imaginaryPoints.push({
        point: rotatePoint([rotatedFirstPoint[0] - (i + 1) * gridWidth, rotatedFirstPoint[1]], originAngle),
        row: index,
        col: imaginaryPointsCount - 1 - i,
        isImaginary: true,
        annotations: "",
      });
    }


    // Rotate back and combine with existing points
    let normalizedRow = imaginaryPoints.concat(
      row.map((core) => {
        return {
          ...core,
          point: core.point,
        };
      })
    );

    // Update col index for all points
    normalizedRow.forEach((core, index) => (core.col = index));

    return normalizedRow;
  });
}

async function runTravelingAlgorithm(normalizedCores, params) {
  const delaunayTriangleEdges = getEdgesFromTriangulation(normalizedCores);
  const lengthFilteredEdges = filterEdgesByLength(
    delaunayTriangleEdges,
    normalizedCores,
    params.thresholdMultiplier
  );

  let bestEdgeSet = filterEdgesByAngle(
    lengthFilteredEdges,
    normalizedCores,
    params.thresholdAngle,
    params.originAngle
  );
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

  function sortRowsByRotatedPoints(rows, originAngle) {

    // Temporarily rotate the first point of each row for sorting purposes
    let sortingHelper = rows.map((row) => {
      return {
        originalRow: row,
        rotatedPoint: rotatePoint(row[0]["point"], -originAngle),
      };
    });

    // Sort the rows based on the y-coordinate of the rotated first point in each row
    sortingHelper.sort((a, b) => a.rotatedPoint[1] - b.rotatedPoint[1]);

    // Extract the original rows in sorted order
    return sortingHelper.map((item) => item.originalRow);
  }

  // Extract the original rows in sorted order
  let sortedRows = sortRowsByRotatedPoints(rows, params.originAngle);
  // Calculate the median x coordinate for the first column
  let medianX = calculateMedianX(sortedRows, params.originAngle);
  // Normalize rows by adding imaginary points
  sortedRows = normalizeRowsByAddingImaginaryPoints(
    sortedRows,
    medianX,
    params.gridWidth,
    params.originAngle
  );

  const userRadius = document.getElementById("userRadius").value;

  let sortedData = [];
  sortedRows.forEach((row, rowIndex) => {
    row.forEach((core, colIndex) => {

      // Add the core or imaginary point to sortedData
      sortedData.push({
        x: core.point[0] + window.preprocessingData.minX,
        y: core.point[1] + window.preprocessingData.minY,
        row: rowIndex,
        col: colIndex,
        currentRadius: parseInt(userRadius),
        isImaginary: core.isImaginary,
        annotations: "",
      });
    });
  });

  window.sortedCoresData = sortedData;
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
      normalizedCores,
      lengthFilteredEdges,
      params.minAngle,
      params.maxAngle,
      params.angleStepSize,
      params.angleThreshold
    );

  let coordinatesInput = bestEdgeSet.map(([start, end]) => {
    return [
      [normalizedCores[start].x, normalizedCores[start].y],
      [normalizedCores[end].x, normalizedCores[end].y],
    ];
  });

  // Calculate the average distance and the image width
  const d = calculateAverageDistance(coordinatesInput);
  const imageWidth = calculateGridWidth(normalizedCores, d, params.multiplier);

  // Update the form values with the new calculations
  document.getElementById("originAngle").value = originAngle.toFixed(2);
  document.getElementById("gridWidth").value = d.toFixed(2);
  document.getElementById("imageWidth").value = imageWidth.toFixed(2);
  document.getElementById("gamma").value = d.toFixed(2);

  // Update the params object with the new calculations
  params.originAngle = originAngle;
  params.gridWidth = d;
  params.imageWidth = imageWidth;
  params.gamma = d;
}

function saveUpdatedCores() {
  if (!window.sortedCoresData) {
    alert("No data available to save.");
    return;
  }

  // Download the updated cores data as a JSON file

  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(window.sortedCoresData));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "updated_cores.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export {
  rotatePoint,
  runTravelingAlgorithm,
  loadDataAndDetermineParams,
  saveUpdatedCores,
  preprocessForTravelingAlgorithm,
};
