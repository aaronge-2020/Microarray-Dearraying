import { getHyperparametersFromUI } from "./UI.js";
import { runTravelingAlgorithm } from "./data_processing.js";

import { preprocessCores } from "./delaunay_triangulation.js";

import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.14.0/+esm";
let lastActionTime = 0;
const actionDebounceInterval = 500; // milliseconds

// Pure function to get input values
const getInputValue = (inputId) => document.getElementById(inputId).value;

// Global variables to hold the history for undo and redo
window.actionHistory = [];
let currentActionIndex = -1;

// Function to add a core
function addCore(x, y) {
  const newCore = { x, y, radius: 10 }; // Set radius as needed
  window.properties.push(newCore);
  console.log(newCore);
  window.preprocessedCores = preprocessCores(window.properties);
  recordAction({ type: "add", core: newCore });
  redrawCanvas();
}

// Function to remove the nearest core
function removeCore(x, y) {
  const indexToRemove = findNearestCoreIndex(x, y);
  if (indexToRemove !== -1) {
    const removedCore = window.properties.splice(indexToRemove, 1)[0];
    window.preprocessedCores = preprocessCores(window.properties);

    recordAction({ type: "remove", core: removedCore });
    redrawCanvas();
  }
}

// Function to record actions for undo/redo
function recordAction(action) {
  if (currentActionIndex < window.actionHistory.length - 1) {
    window.actionHistory = window.actionHistory.slice(
      0,
      currentActionIndex + 1
    );
  }
  window.actionHistory.push(action);
  currentActionIndex++;
}

// Undo and Redo Functions
function undo() {
  if (currentActionIndex >= 0) {
    const action = window.actionHistory[currentActionIndex];
    revertAction(action);
    currentActionIndex--;
    redrawCanvas();
  }
}

function redo() {
  if (currentActionIndex < window.actionHistory.length - 1) {
    currentActionIndex++;
    const action = window.actionHistory[currentActionIndex];
    applyAction(action);
    redrawCanvas();
  }
}

// Helper functions to revert or apply actions
function revertAction(action) {
  if (action.type === "add") {
    window.properties.pop();
  } else if (action.type === "remove") {
    window.properties.push(action.core);
  }
}

function applyAction(action) {
  if (action.type === "add") {
    window.properties.push(action.core);
  } else if (action.type === "remove") {
    const indexToRemove = findNearestCoreIndex(action.core.x, action.core.y);
    if (indexToRemove !== -1) {
      window.properties.splice(indexToRemove, 1);
    }
  }
}

// Utility function to redraw the canvas
function redrawCanvas() {
  const maskAlpha = parseFloat(getInputValue("maskAlphaSlider"));

  const originalImageContainer = document.getElementById("originalImage");

  visualizeSegmentationResults(
    // Pass the necessary arguments like original image, predictions, etc.
    originalImageContainer,
    window.thresholdedPredictions,
    window.properties,
    "segmentationResultsCanvas",
    maskAlpha
  );
}

// Function to find the nearest core index
function findNearestCoreIndex(x, y) {
  let nearestIndex = -1;
  let minDistance = Infinity;
  window.properties.forEach((core, index) => {
    const distance = Math.sqrt((core.x - x) ** 2 + (core.y - y) ** 2);
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

// Visualization function
async function visualizeSegmentationResults(
  originalImage,
  predictions,
  properties,
  canvasID,
  alpha = 0.3
) {
  const [width, height] = [
    originalImage.naturalWidth,
    originalImage.naturalHeight,
  ];
  const canvas = document.getElementById(canvasID);
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;

  // Draw the original image onto the canvas
  ctx.drawImage(originalImage, 0, 0, width, height);

  // Process predictions and draw the mask on top of the original image
  const mask = await tf.tidy(() => {
    const clippedPredictions = predictions.clipByValue(0, 1);
    const resizedPredictions = tf.image.resizeBilinear(
      clippedPredictions,
      [1024, 1024]
    );
    const squeezedPredictions = resizedPredictions.squeeze();
    return squeezedPredictions.arraySync(); // Convert to a regular array for pixel manipulation
  });

  // Draw the mask with semi-transparency
  ctx.globalAlpha = alpha;
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const maskValue = mask[i][j];
      if (maskValue > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${maskValue})`;
        ctx.fillRect(j, i, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1.0;

  // Draw a red dot at each centroid
  // Ensure properties is an array before using forEach
  if (properties && typeof properties === "object") {
    properties = Object.values(properties); // Convert object to array if necessary
  }

  properties.forEach((prop) => {
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "blue";
    ctx.fill();
  });

  // Since we used arraySync, we're responsible for disposing of the predictions tensor
  // predictions.dispose();

  // Event listener for canvas clicks to add/remove cores
  canvas.addEventListener("mousedown", (event) => {
    const currentTime = Date.now();
    if (currentTime - lastActionTime > actionDebounceInterval) {
      const { offsetX, offsetY } = event;
      if (event.shiftKey) {
        removeCore(offsetX, offsetY);
      } else {
        addCore(offsetX, offsetY);
      }
      lastActionTime = currentTime;
    }
  });

  document
    .getElementById("undoButton")
    .addEventListener("mousedown", function () {
      // Undo action here

      const currentTime = Date.now();
      if (currentTime - lastActionTime > actionDebounceInterval) {
        undo();
      }
      lastActionTime = currentTime;
    });

  document
    .getElementById("redoButton")
    .addEventListener("mousedown", function () {
      // Redo action here
      const currentTime = Date.now();
      if (currentTime - lastActionTime > actionDebounceInterval) {
        redo();
      }
      lastActionTime = currentTime;
    });
}

function drawCoresOnCanvasForTravelingAlgorithm(imageSrc, coresData) {
  const img = new Image();
  img.src = imageSrc;
  const canvas = document.getElementById("coreCanvas");
  const ctx = canvas.getContext("2d");
  let selectedCore = null;
  let isDragging = false;
  let isAltDown = false; // Track the state of the Alt key

  let selectedIndex = null; // Index of the selected core

  img.onload = () => {
    drawCores();
  };
  function drawCores() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, img.width, img.height);
    window.sortedCoresData.forEach((core, index) => {
      drawCore(core, index === selectedIndex);
    });
  }
  
  function drawCore(core, isSelected) {
    // Shadow for a three-dimensional effect
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = isSelected ? 10 : 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  
    // Core circle
    ctx.beginPath();
    ctx.arc(core.x, core.y, core.currentRadius, 0, Math.PI * 2);
    ctx.strokeStyle = core.isImaginary ? "#FFA500" : "#0056b3"; // Orange for imaginary, blue for real
    ctx.lineWidth = isSelected ? 4 : 2; // Thicker border for selected core
    ctx.stroke();
  
    // Reset shadow for text
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  
    // Core labels
    ctx.fillStyle = isSelected ? "#FFD700" : "#333"; // Gold for selected, dark grey for others
    ctx.font = isSelected ? "bold 14px Arial" : "12px Arial";
    const textMetrics = ctx.measureText(`(${core.row + 1},${core.col + 1})`);
    ctx.fillText(
      `(${core.row + 1},${core.col + 1})`,
      core.x - textMetrics.width / 2,
      core.y - core.currentRadius - 10
    );
  }
  

  function updateSidebar(core) {
    document.getElementById("rowInput").value = core ? core.row + 1 : "";
    document.getElementById("columnInput").value = core ? core.col + 1 : "";
    document.getElementById("xInput").value = core ? core.x : "";
    document.getElementById("yInput").value = core ? core.y : "";
    document.getElementById("radiusInput").value = core
      ? core.currentRadius
      : "";
    document.getElementById("annotationsInput").value = core
      ? core.annotations
      : "";

    // Set the correct radio button based on the isImaginary property
    if (core) {
      document.getElementById("realInput").checked = !core.isImaginary;
      document.getElementById("imaginaryInput").checked = core.isImaginary;
    } else {
      // If no core is selected, reset the radio buttons
      document.getElementById("realInput").checked = false;
      document.getElementById("imaginaryInput").checked = false;
    }

    document
      .getElementById("radiusInput")
      .addEventListener("change", function (event) {
        if (selectedIndex !== null) {
          window.sortedCoresData[selectedIndex].currentRadius = parseFloat(
            event.target.value
          );
          drawCores();
        }
      });
  }
  canvas.addEventListener("mousedown", (event) => {
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;
    selectedIndex = window.sortedCoresData.findIndex(
      (core) =>
        Math.sqrt((core.x - mouseX) ** 2 + (core.y - mouseY) ** 2) <
        core.currentRadius
    );

    if (selectedIndex !== -1) {
      selectedCore = window.sortedCoresData[selectedIndex];
      isDragging = true;
      updateSidebar(selectedCore);
      drawCores();
    } else {
      updateSidebar(null);
      drawCores();
    }
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!isDragging || !selectedCore) return;

    if (isAltDown) {
      // Resizing logic when Alt key is down
      let dx = event.offsetX - selectedCore.x;
      let dy = event.offsetY - selectedCore.y;
      selectedCore.currentRadius = Math.sqrt(dx * dx + dy * dy);
    } else {
      // Dragging logic
      selectedCore.x = event.offsetX;
      selectedCore.y = event.offsetY;
    }

    if (isDragging && selectedIndex !== null) {
      updateSidebar(window.sortedCoresData[selectedIndex]); // Update sidebar during dragging
    }

    drawCores();
  });

  canvas.addEventListener("mouseup", (event) => {
    if (selectedIndex !== null) {
      updateSidebar(window.sortedCoresData[selectedIndex]); // Update sidebar on mouseup
    }
    isDragging = false;
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Alt") {
      isAltDown = true;
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "Alt") {
      isAltDown = false;
    }
  });
  document
    .getElementById("saveCoreEdits")
    .addEventListener("click", function () {
      if (selectedIndex !== null) {
        const core = window.sortedCoresData[selectedIndex];
        core.row = parseInt(document.getElementById("rowInput").value, 10) - 1;
        core.col =
          parseInt(document.getElementById("columnInput").value, 10) - 1;
        core.x = parseFloat(document.getElementById("xInput").value);
        core.y = parseFloat(document.getElementById("yInput").value);
        core.currentRadius = parseFloat(
          document.getElementById("radiusInput").value
        );
        core.annotations = document.getElementById("annotationsInput").value;

        // Update the isImaginary property based on which radio button is checked
        core.isImaginary = document.getElementById("imaginaryInput").checked;

        drawCores(); // Redraw the cores with the updated data
      }
    });
}

async function applyAndVisualizeTravelingAlgorithm() {
  if (window.preprocessedCores) {
    console.log(window.preprocessedCores.length);
    await runTravelingAlgorithm(
      window.preprocessedCores,
      getHyperparametersFromUI()
    );

    // Use the loaded image if available, otherwise use default or file input image
    const imageSrc = window.loadedImg
      ? window.loadedImg.src
      : document.getElementById("fileInput").files.length > 0
      ? URL.createObjectURL(document.getElementById("fileInput").files[0])
      : "path/to/default/image.jpg";

    drawCoresOnCanvasForTravelingAlgorithm(imageSrc, window.sortedCoresData);
  } else {
    console.error("No cores data available. Please load a file first.");
  }
}

function obtainHyperparametersAndDrawVirtualGrid() {
  const horizontalSpacing = parseInt(
    document.getElementById("horizontalSpacing").value,
    10
  );

  const verticalSpacing = parseInt(
    document.getElementById("verticalSpacing").value,
    10
  );
  const startingX = parseInt(document.getElementById("startingX").value, 10);
  const startingY = parseInt(document.getElementById("startingY").value, 10);

  createVirtualGrid(
    window.sortedCoresData,
    horizontalSpacing,
    verticalSpacing,
    startingX,
    startingY
  );
}

function createVirtualGrid(
  sortedCoresData,
  horizontalSpacing,
  verticalSpacing,
  startingX,
  startingY
) {
  // Use the loaded image if available, otherwise use default or file input image

  const imageSrc = window.loadedImg
    ? window.loadedImg.src
    : document.getElementById("fileInput").files.length > 0
    ? URL.createObjectURL(document.getElementById("fileInput").files[0])
    : "path/to/default/image.jpg";

  const virtualGridCanvas = document.getElementById("virtualGridCanvas");
  if (!virtualGridCanvas) {
    console.error("Virtual grid canvas not found");
    return;
  }

  const rows =
    sortedCoresData.reduce((acc, core) => Math.max(acc, core.row), 0) + 1;
  const cols =
    sortedCoresData.reduce((acc, core) => Math.max(acc, core.col), 0) + 1;
  const defaultRadius = parseInt(document.getElementById("userRadius").value);
  virtualGridCanvas.width =
    cols * horizontalSpacing + defaultRadius * 2 + startingX;
  virtualGridCanvas.height =
    rows * verticalSpacing + defaultRadius * 2 + startingY;

  const vctx = virtualGridCanvas.getContext("2d");
  const img = new Image();
  img.src = imageSrc;

  img.onload = () => {
    vctx.clearRect(0, 0, virtualGridCanvas.width, virtualGridCanvas.height);

    sortedCoresData.forEach((core) => {
      const idealX = startingX + core.col * horizontalSpacing;
      const idealY = startingY + core.row * verticalSpacing;
      const userRadius = core.currentRadius;

      vctx.save();
      vctx.beginPath();
      vctx.arc(idealX, idealY, userRadius, 0, Math.PI * 2, true);
      vctx.closePath();

      // Use the isImaginary flag to determine the stroke style
      vctx.strokeStyle = core.isImaginary ? "red" : "green";
      vctx.lineWidth = 2; // Adjust line width as needed
      vctx.stroke();

      vctx.clip();

      const sourceX = core.x - userRadius;
      const sourceY = core.y - userRadius;

      vctx.drawImage(
        img,
        sourceX,
        sourceY,
        userRadius * 2,
        userRadius * 2,
        idealX - userRadius,
        idealY - userRadius,
        userRadius * 2,
        userRadius * 2
      );

      vctx.restore();

      vctx.fillStyle = "black"; // Text color
      vctx.font = "12px Arial"; // Text font and size
      vctx.fillText(
        `(${core.row + 1},${core.col + 1})`,
        idealX - userRadius / 2,
        idealY - userRadius / 2
      );
    });
  };

  img.onerror = () => {
    console.error("Image failed to load.");
  };
}

function updateVirtualGridSpacing(
  horizontalSpacing,
  verticalSpacing,
  startingX,
  startingY
) {
  const virtualGridCanvas = document.getElementById("virtualGridCanvas");
  const vctx = virtualGridCanvas.getContext("2d");

  // Clear the existing grid
  vctx.clearRect(0, 0, virtualGridCanvas.width, virtualGridCanvas.height);

  // Redraw the grid with new spacings
  createVirtualGrid(
    window.sortedCoresData,
    horizontalSpacing,
    verticalSpacing,
    startingX,
    startingY
  );
}

// Function to redraw the cores on the canvas
function redrawCoresForTravelingAlgorithm() {
  const imageFile = document.getElementById("fileInput").files[0];
  if ((imageFile || window.loadedImg) && window.preprocessedCores) {
    if (window.loadedImg) {
      drawCoresOnCanvasForTravelingAlgorithm(
        window.loadedImg.src,
        window.preprocessedCores
      );
    } else {
      drawCoresOnCanvasForTravelingAlgorithm(
        URL.createObjectURL(imageFile),
        window.preprocessedCores
      );
    }
  } else {
    alert("Please load an image first.");
  }
}

export {
  drawCoresOnCanvasForTravelingAlgorithm,
  applyAndVisualizeTravelingAlgorithm,
  createVirtualGrid,
  updateVirtualGridSpacing,
  redrawCoresForTravelingAlgorithm,
  visualizeSegmentationResults,
  obtainHyperparametersAndDrawVirtualGrid,
};
