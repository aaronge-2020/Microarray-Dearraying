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
      await loadDataAndDetermineParams(
        window.cores,
        getHyperparametersFromUI()
      );

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
    await runTravelingAlgorithm(window.cores, getHyperparametersFromUI());
    const imageSrc =
      document.getElementById("imageInput").files.length > 0
        ? URL.createObjectURL(document.getElementById("imageInput").files[0])
        : "path/to/default/image.jpg";

    drawCoresOnCanvas(imageSrc, window.cores);

    // Create the virtual grid
    createVirtualGrid(imageSrc, window.sortedCoresData, 25, 25, 50, 50);
  } else {
    console.error("No cores data available. Please load a file first.");
  }
}

function createVirtualGrid(imageSrc, sortedCoresData, horizontalSpacing, verticalSpacing, startingX, startingY) {
  const virtualGridCanvas = document.getElementById('virtualGridCanvas');
  if (!virtualGridCanvas) {
    console.error('Virtual grid canvas not found');
    return;
  }
  
  // Calculate the new canvas size based on the number of rows and columns and spacing
  const rows = sortedCoresData.reduce((acc, core) => Math.max(acc, core.row), 0) + 1;
  const cols = sortedCoresData.reduce((acc, core) => Math.max(acc, core.col), 0) + 1;
  const userRadius = parseInt(document.getElementById("userRadius").value);
  virtualGridCanvas.width = cols * horizontalSpacing + userRadius * 2; // Add some padding
  virtualGridCanvas.height = rows * verticalSpacing + userRadius * 2;

  const vctx = virtualGridCanvas.getContext('2d');
  const img = new Image();
  img.src = imageSrc;

  img.onload = () => {
    // Clear the virtual grid before redrawing
    vctx.clearRect(0, 0, virtualGridCanvas.width, virtualGridCanvas.height);

    sortedCoresData.forEach(core => {
      const xOffset = parseInt(document.getElementById("xOffset").value);
      const yOffset = parseInt(document.getElementById("yOffset").value);
      const idealX = core.col * horizontalSpacing + startingX;
      const idealY = core.row * verticalSpacing + startingY;

      // Save the context state before clipping
      vctx.save();

      // Create a path for the circle
      vctx.beginPath();
      vctx.arc(idealX, idealY, userRadius, 0, Math.PI * 2, true);
      vctx.closePath();
      vctx.clip();

      // Calculate source coordinates taking offsets into account
      const sourceX = core.x + xOffset - userRadius;
      const sourceY = core.y + yOffset - userRadius;

      // Draw the cropped core onto the virtual grid canvas
      vctx.drawImage(
        img,
        sourceX, sourceY,
        userRadius * 2, userRadius * 2,
        idealX - userRadius, idealY - userRadius,
        userRadius * 2, userRadius * 2
      );

      // Restore the context to draw text
      vctx.restore();

      // Draw row/col text
      vctx.fillStyle = 'black'; // Text color
      vctx.font = '12px Arial'; // Text font and size
      vctx.fillText(`(${core.row},${core.col})`, idealX - userRadius, idealY - userRadius);
    });
  };

  img.onerror = () => {
    console.error('Image failed to load.');
  };
}


// Add event listeners for range inputs to show the current value
document.getElementById('horizontalSpacing').addEventListener('input', function() {
  document.getElementById('horizontalSpacingValue').textContent = this.value;
});

document.getElementById('verticalSpacing').addEventListener('input', function() {
  document.getElementById('verticalSpacingValue').textContent = this.value;
});

// Add event listeners for range inputs to show the current value
document.getElementById('startingX').addEventListener('input', function() {
  document.getElementById('startingXValue').textContent = this.value;
});

document.getElementById('startingY').addEventListener('input', function() {
  document.getElementById('startingYValue').textContent = this.value;
});


// Event listeners for tab buttons
document.getElementById("rawDataTabButton").addEventListener("click", function() {
  showRawDataSidebar();
  highlightTab(this); // This function will highlight the active tab, it's implementation is shown below
});

document.getElementById("virtualGridTabButton").addEventListener("click", function() {
  showVirtualGridSidebar();
  highlightTab(this); // This function will highlight the active tab, it's implementation is shown below
});

// Function to highlight the active tab
function highlightTab(activeTab) {
  // Remove active class from all tabs
  document.querySelectorAll('.tablinks').forEach(tab => {
    tab.classList.remove('active');
  });
  // Add active class to the clicked tab
  activeTab.classList.add('active');
}

// Function to show raw data sidebar
function showRawDataSidebar() {
  document.getElementById("rawDataSidebar").style.display = 'block';
  document.getElementById("virtualGridSidebar").style.display = 'none';
}

// Function to show virtual grid sidebar
function showVirtualGridSidebar() {
  document.getElementById("rawDataSidebar").style.display = 'none';
  document.getElementById("virtualGridSidebar").style.display = 'block';
}


// JavaScript to handle the virtual grid sidebar hyperparameters and update the grid
document.getElementById('applyVirtualGridSettings').addEventListener('click', function() {
  const horizontalSpacing = parseInt(document.getElementById('horizontalSpacing').value, 10);
  const verticalSpacing = parseInt(document.getElementById('verticalSpacing').value, 10);
  const startingX = parseInt(document.getElementById('startingX').value, 10);
  const startingY = parseInt(document.getElementById('startingY').value, 10);

  // Update the virtual grid with the new spacing values
  updateVirtualGridSpacing(horizontalSpacing, verticalSpacing, startingX, startingY);
});

function updateVirtualGridSpacing(horizontalSpacing, verticalSpacing, startingX, startingY) {
  const virtualGridCanvas = document.getElementById('virtualGridCanvas');
  const vctx = virtualGridCanvas.getContext('2d');
  const imageSrc = document.getElementById('imageInput').files[0] 
                   ? URL.createObjectURL(document.getElementById('imageInput').files[0]) 
                   : 'path/to/default/image.jpg'; // Handle the default image source appropriately
  
  // Clear the existing grid
  vctx.clearRect(0, 0, virtualGridCanvas.width, virtualGridCanvas.height);
  
  // Redraw the grid with new spacings
  createVirtualGrid(imageSrc, window.sortedCoresData, horizontalSpacing, verticalSpacing, startingX, startingY);
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

  // visualizeSortedRows(
  //   sortedRows,
  //   "visualization",
  //   window.preprocessingData.minX,
  //   window.preprocessingData.minY
  // );
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

document
  .getElementById("saveResults")
  .addEventListener("click", saveUpdatedCores);

document
  .getElementById("toggle-advanced-settings")
  .addEventListener("click", function () {
    var advancedSettings = document.getElementById("advanced-settings");
    if (advancedSettings.style.display === "none") {
      advancedSettings.style.display = "block";
      this.textContent = "Hide Advanced Settings";
    } else {
      advancedSettings.style.display = "none";
      this.textContent = "Show Advanced Settings";
    }
  });

// document.getElementById('imageInput').addEventListener('change', handleImageSelect, false);

// function handleImageSelect(event) {
//   const reader = new FileReader();
//   reader.onload = function(e) {
//     const img = new Image();
//     img.onload = function() {
//       const canvas = document.getElementById('coreCanvas');
//       const ctx = canvas.getContext('2d');
//       ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
//       // Additional processing can be added here
//     };
//     img.src = e.target.result;
//   };
//   reader.readAsDataURL(event.target.files[0]);
// }

document
  .getElementById("imageInput")
  .addEventListener("change", function (event) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const imageSrc = e.target.result;

      // Check if cores data is available before drawing
      if (window.cores && window.cores.length > 0) {
        const xOffsetValue = document.getElementById("xOffsetValue");
        const xOffset = document.getElementById("xOffset");
        xOffset.value = window.preprocessingData.minX;
        xOffsetValue.value = window.preprocessingData.minX; // Update the output element with the slider value

        const yOffset = document.getElementById("yOffset");
        const yOffsetValue = document.getElementById("yOffsetValue");
        yOffsetValue.value = window.preprocessingData.minY; // Update the output element with the slider value
        yOffset.value = window.preprocessingData.minY;

        // If there's an image and cores data, draw the cores with the new radius
        drawCoresOnCanvas(
          imageSrc,
          window.cores,
          window.preprocessingData.minX,
          window.preprocessingData.minY
        );
      } else {
        alert("Please load the JSON file first.");
      }
    };
    reader.readAsDataURL(event.target.files[0]);
  });
document.getElementById("userRadius").addEventListener("input", function () {
  const radiusValue = document.getElementById("radiusValue");
  const userRadius = document.getElementById("userRadius").value;
  radiusValue.value = userRadius; // Update the output element with the slider value

  const imageFile = document.getElementById("imageInput").files[0];
  if (imageFile && window.cores) {
    // If there's an image and cores data, draw the cores with the new radius
    redrawCores();
  } else {
    alert("Please load an image and JSON file first.");
  }
});

// Event listener for X Offset Slider
document.getElementById("xOffset").addEventListener("input", function () {
  const xOffsetValue = document.getElementById("xOffsetValue");
  xOffsetValue.value = this.value; // Update the output element with the slider value
  redrawCores(); // Redraw cores with new offsets
});

// Event listener for Y Offset Slider
document.getElementById("yOffset").addEventListener("input", function () {
  const yOffsetValue = document.getElementById("yOffsetValue");
  yOffsetValue.value = this.value; // Update the output element with the slider value
  redrawCores(); // Redraw cores with new offsets
});
// Function to redraw the cores on the canvas
function redrawCores() {
  const imageFile = document.getElementById("imageInput").files[0];
  if (imageFile && window.cores) {
    drawCoresOnCanvas(URL.createObjectURL(imageFile), window.cores);
  } else {
    alert("Please load an image and JSON file first.");
  }
}
function drawCoresOnCanvas(imageSrc, coresData) {
  const img = new Image();
  img.src = imageSrc;

  img.onload = () => {
    const canvas = document.getElementById("coreCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, img.width, img.height);

    const userRadius = parseInt(document.getElementById("userRadius").value);
    const xOffset = parseInt(document.getElementById("xOffset").value);
    const yOffset = parseInt(document.getElementById("yOffset").value);

    if (window.sortedCoresData && window.sortedCoresData.length > 0) {
      // Process sorted data and draw circles with row/col information
      window.sortedCoresData.forEach((sortedCore) => {
        ctx.beginPath();
        ctx.arc(
          sortedCore.x + xOffset,
          sortedCore.y + yOffset,
          userRadius,
          0,
          Math.PI * 2
        );
        ctx.lineWidth = 2;

        // Check if the core is imaginary and set the color accordingly
        if (sortedCore.isImaginary) {
          ctx.strokeStyle = "orange";
        } else {
          ctx.strokeStyle = "red";
        }

        ctx.stroke();

        // Draw row/col information
        ctx.fillStyle = "blue"; // Text color
        ctx.font = "10px Arial"; // Text font and size
        ctx.fillText(
          `(${sortedCore.row},${sortedCore.col})`,
          sortedCore.x + xOffset - userRadius + 2,
          sortedCore.y + yOffset
        );
      });
    } else {
      // Draw only red circles for real cores if sorted data is not available
      coresData.forEach((core) => {
        ctx.beginPath();
        ctx.arc(core.x + xOffset, core.y + yOffset, userRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  };
}
