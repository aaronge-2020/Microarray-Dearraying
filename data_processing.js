
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
  
    // Temporarily rotate the first point of each row for sorting purposes
    let sortingHelper = rows.map((row) => {
      return {
        originalRow: row,
        rotatedPoint: rotatePoint(row[0]["point"], -params.originAngle),
      };
    });
  
    // Sort the rows based on the y-coordinate of the rotated first point in each row
    sortingHelper.sort((a, b) => a.rotatedPoint[1] - b.rotatedPoint[1]);
  
    // Extract the original rows in sorted order
    let sortedRows = sortingHelper.map((item) => item.originalRow);
  
    let sortedData = [];
    sortedRows.forEach((row, rowIndex) => {
      row.forEach((core, colIndex) => {
        // Check if the core is an imaginary point
        let isImaginary = core.isImaginary || false; // Assuming 'isImaginary' is set for imaginary points
  
        // Add the core or imaginary point to sortedData
        sortedData.push({
          x: core.point[0],
          y: core.point[1],
          row: rowIndex,
          col: colIndex,
          isImaginary: isImaginary,
        });
      });
    });
  
    window.sortedCoresData = sortedData;
  
    // Set the window.finalCores to be the sortedData + the window.preprocessingData.minX /minY
  
    window.finalCores = sortedData.map((core) => {
      return {
        x: core.x + window.preprocessingData.minX,
        y: core.y + window.preprocessingData.minY,
        row: core.row,
        col: core.col,
        isImaginary: core.isImaginary,
      };
    });
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
  
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(window.finalCores));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "updated_cores.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  export{
    rotatePoint,
    runTravelingAlgorithm,
    loadDataAndDetermineParams,
    saveUpdatedCores
  }