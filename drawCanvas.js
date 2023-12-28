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
  const newCore = { x, y, radius: 4 }; // Set defaultRadius as needed
  window.properties.push(newCore);
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

// function drawCoresOnCanvasForTravelingAlgorithm(imageSrc, coresData) {
//   const img = new Image();
//   img.src = imageSrc;

//   img.onload = () => {
//     const canvas = document.getElementById("coreCanvas");
//     const ctx = canvas.getContext("2d");
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     ctx.drawImage(img, 0, 0, img.width, img.height);

//     const userRadius = parseInt(document.getElementById("userRadius").value);
//     const xOffset = parseInt(document.getElementById("xOffset").value);
//     const yOffset = parseInt(document.getElementById("yOffset").value);

//     if (window.sortedCoresData && window.sortedCoresData.length > 0) {
//       // Process sorted data and draw circles with row/col information
//       window.sortedCoresData.forEach((sortedCore) => {
//         ctx.beginPath();
//         ctx.arc(
//           sortedCore.x + xOffset,
//           sortedCore.y + yOffset,
//           userRadius,
//           0,
//           Math.PI * 2
//         );
//         ctx.lineWidth = 2;

//         // Check if the core is imaginary and set the color accordingly
//         if (sortedCore.isImaginary) {
//           ctx.strokeStyle = "orange";
//         } else {
//           ctx.strokeStyle = "red";
//         }

//         ctx.stroke();

//         // Draw row/col information
//         ctx.fillStyle = "blue"; // Text color
//         ctx.font = "10px Arial"; // Text font and size
//         ctx.fillText(
//           `(${sortedCore.row + 1},${sortedCore.col + 1})`,
//           sortedCore.x + xOffset - userRadius + 2,
//           sortedCore.y + yOffset
//         );
//       });
//     } else {
//       // Draw only red circles for real cores if sorted data is not available
//       coresData.forEach((core) => {
//         ctx.beginPath();
//         ctx.arc(core.x + xOffset, core.y + yOffset, userRadius, 0, Math.PI * 2);
//         ctx.strokeStyle = "red";
//         ctx.lineWidth = 2;
//         ctx.stroke();
//       });
//     }
//   };
// }


// Updated applyAndVisualize function


function drawCoresOnCanvasForTravelingAlgorithm(imageSrc, coresData) {
  const img = new Image();
  img.src = imageSrc;
  const canvas = document.getElementById("coreCanvas");
  const ctx = canvas.getContext("2d");
  let selectedCore = null;
  let isDragging = false;


  img.onload = () => {
    drawCores();
  };

  function drawCores() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, img.width, img.height);
    window.sortedCoresData.forEach(drawCore);
  }

  function drawCore(core) {
    ctx.beginPath();
    ctx.arc(core.x , core.y , core.defaultRadius, 0, Math.PI * 2);
    ctx.strokeStyle = core.isImaginary ? "orange" : "red";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "blue";
    ctx.font = "10px Arial";
    ctx.fillText(`(${core.row},${core.col})`, core.x - core.defaultRadius + 2 , core.y );
  }

  canvas.addEventListener("mousedown", (event) => {

    const mouseX = event.offsetX;
    const mouseY = event.offsetY;
    selectedCore = window.sortedCoresData.find(core => 
      Math.sqrt(((core.x ) - mouseX) ** 2 + (core.y - mouseY) ** 2) < core.defaultRadius
    );

    if (selectedCore) {
      isDragging = true;
    }
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!isDragging || !selectedCore) return;

    selectedCore.x = event.offsetX;
    selectedCore.y = event.offsetY;
    drawCores();
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;
    selectedCore = null;
  });
}

function updateCoreProperties(coreIndex, newProperties) {
  const core = window.sortedCoresData[coreIndex];
  if (!core) return;

  Object.assign(core, newProperties);
  // Use the loaded image if available, otherwise use default or file input image
  const imageSrc = window.loadedImg
  ? window.loadedImg.src
  : document.getElementById("fileInput").files.length > 0
  ? URL.createObjectURL(document.getElementById("fileInput").files[0])
  : "path/to/default/image.jpg";

    drawCoresOnCanvasForTravelingAlgorithm(imageSrc, window.sortedCoresData);
}



async function applyAndVisualize() {
  if (window.preprocessedCores) {
    await runTravelingAlgorithm(window.preprocessedCores, getHyperparametersFromUI());

    // Use the loaded image if available, otherwise use default or file input image
    const imageSrc = window.loadedImg
      ? window.loadedImg.src
      : document.getElementById("fileInput").files.length > 0
      ? URL.createObjectURL(document.getElementById("fileInput").files[0])
      : "path/to/default/image.jpg";

    drawCoresOnCanvasForTravelingAlgorithm(imageSrc, window.sortedCoresData);

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
      imageSrc,
      window.sortedCoresData,
      horizontalSpacing,
      verticalSpacing,
      startingX,
      startingY
    );
  } else {
    console.error("No cores data available. Please load a file first.");
  }
}

function createVirtualGrid(
  imageSrc,
  sortedCoresData,
  horizontalSpacing,
  verticalSpacing,
  startingX,
  startingY
) {
  const virtualGridCanvas = document.getElementById("virtualGridCanvas");
  if (!virtualGridCanvas) {
    console.error("Virtual grid canvas not found");
    return;
  }

  const rows =
    sortedCoresData.reduce((acc, core) => Math.max(acc, core.row), 0) + 1;
  const cols =
    sortedCoresData.reduce((acc, core) => Math.max(acc, core.col), 0) + 1;
  const userRadius = parseInt(document.getElementById("userRadius").value);
  virtualGridCanvas.width =
    cols * horizontalSpacing + userRadius * 2 + startingX;
  virtualGridCanvas.height =
    rows * verticalSpacing + userRadius * 2 + startingY;

  const vctx = virtualGridCanvas.getContext("2d");
  const img = new Image();
  img.src = imageSrc;

  img.onload = () => {
    vctx.clearRect(0, 0, virtualGridCanvas.width, virtualGridCanvas.height);

    sortedCoresData.forEach((core) => {
      const idealX = startingX + core.col * horizontalSpacing;
      const idealY = startingY + core.row * verticalSpacing;

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
  // Use the loaded image if available, otherwise use default or file input image
  const imageSrc = window.loadedImg
    ? window.loadedImg.src
    : document.getElementById("fileInput").files.length > 0
    ? URL.createObjectURL(document.getElementById("fileInput").files[0])
    : "path/to/default/image.jpg";

  // Clear the existing grid
  vctx.clearRect(0, 0, virtualGridCanvas.width, virtualGridCanvas.height);

  // Redraw the grid with new spacings
  createVirtualGrid(
    imageSrc,
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
  applyAndVisualize,
  createVirtualGrid,
  updateVirtualGridSpacing,
  redrawCoresForTravelingAlgorithm,
  visualizeSegmentationResults,
};
