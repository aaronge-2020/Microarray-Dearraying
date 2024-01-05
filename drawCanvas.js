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

function drawCoresOnCanvasForTravelingAlgorithm() {
  const img = new Image();

  // Use the loaded image if available, otherwise use default or file input image
  img.src = window.loadedImg.src

  const canvas = document.getElementById("coreCanvas");
  const ctx = canvas.getContext("2d");
  let selectedCore = null;
  let isDragging = false;
  let isAltDown = false; // Track the state of the Alt key

  let selectedIndex = null; // Index of the selected core

  let currentMode = "edit"; // Possible values: 'edit', 'add'

  let tempCore = null; // Temporary core for add mode
  let isSettingSize = false; // Track whether setting position or size

  let isDraggingTempCore = false;
  let tempCoreOffsetX = 0;
  let tempCoreOffsetY = 0;

  img.onload = () => {
    drawCores();
  };

  function drawCores() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if(img.src !== window.loadedImg.src) {

      img.src = window.loadedImg.src
    }
    
    ctx.drawImage(img, 0, 0, img.width, img.height);
    window.sortedCoresData.forEach((core, index) => {
      drawCore(core, index === selectedIndex);
    });

    if (tempCore) {
      drawCore(tempCore, false);
    }
  }

  function drawCore(core, isSelected) {
    // Shadow for a three-dimensional effect
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = isSelected ? 10 : 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Core circle
    ctx.beginPath();
    ctx.arc(core.x, core.y, core.currentRadius, 0, Math.PI * 2);
    // Check if the core is temporary and change color
    if (core.isTemporary) {
      ctx.strokeStyle = "#808080"; // For example, a bright pink color
      // Ensure the temporary core has dashed lines
      ctx.setLineDash([5, 5]);
    } else {
      ctx.strokeStyle = core.isImaginary ? "#FFA500" : "#0056b3"; // Original color logic
      ctx.setLineDash([]); // Reset line dash
    }
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

  // Function to switch modes
  function switchMode(newMode) {
    currentMode = newMode;

    // Reset selected index when switching modes
    selectedIndex = null;
    updateSidebar(null);

    if (newMode === "edit") {
      document.getElementById("editSidebar").style.display = "block";
      document.getElementById("addSidebar").style.display = "none";
    } else if (newMode === "add") {
      document.getElementById("editSidebar").style.display = "none";
      document.getElementById("addSidebar").style.display = "block";
    }
  }

  // Modified updateSidebar function to handle add mode
  function updateSidebar(core) {
    const sidebarPrefix = currentMode === "edit" ? "edit" : "add";
    document.getElementById(sidebarPrefix + "RowInput").value = core
      ? core.row + 1
      : "";
    document.getElementById(sidebarPrefix + "ColumnInput").value = core
      ? core.col + 1
      : "";
    document.getElementById(sidebarPrefix + "XInput").value = core
      ? core.x
      : "";
    document.getElementById(sidebarPrefix + "YInput").value = core
      ? core.y
      : "";
    document.getElementById(sidebarPrefix + "RadiusInput").value = core
      ? core.currentRadius
      : "";
    document.getElementById(sidebarPrefix + "AnnotationsInput").value = core
      ? core.annotations
      : "";
    if (core && currentMode === "edit") {
      document.getElementById(sidebarPrefix + "RealInput").checked =
        !core.isImaginary;
      document.getElementById(sidebarPrefix + "ImaginaryInput").checked =
        core.isImaginary;
    }
  }

  canvas.addEventListener("mousedown", (event) => {
    if (currentMode === "add") {
      if (tempCore && !isSettingSize) {
        const dx = event.offsetX - tempCore.x;
        const dy = event.offsetY - tempCore.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < tempCore.currentRadius) {
          isDraggingTempCore = true;
          tempCoreOffsetX = dx;
          tempCoreOffsetY = dy;
        }
      }
    } else {
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
    }
  });

  canvas.addEventListener("click", (event) => {
    const currentTime = Date.now();
    if (currentTime - lastActionTime > actionDebounceInterval) {
      if (currentMode === "add") {
        if (!tempCore) {
          // First click - set position
          tempCore = {
            x: event.offsetX,
            y: event.offsetY,
            row: 0,
            col: 0,
            currentRadius: 5, // Set a default radius
            annotations: "",
            isImaginary: true,
            isTemporary: true,
          };
          isSettingSize = true;
        } else if (isSettingSize) {
          // Second click - set size
          finalizeCoreSize(event);
          updateSidebar(tempCore);
        }
        drawCores(); // Redraw to show or update the temporary core
      }
      lastActionTime = currentTime;
    }
  });

  canvas.addEventListener("mousemove", (event) => {
    if (currentMode === "add") {
      if (isSettingSize) {
        // Dynamically update the size of the temporary core
        updateCoreSize(event);
        drawCores();
      } else if (isDraggingTempCore) {
        tempCore.x = event.offsetX - tempCoreOffsetX;
        tempCore.y = event.offsetY - tempCoreOffsetY;
        updateSidebar(tempCore);
        drawCores();
      } else if (tempCore && isAltDown) {
        // Logic for setting or adjusting the size of the temporary core
        const dx = event.offsetX - tempCore.x;
        const dy = event.offsetY - tempCore.y;
        tempCore.currentRadius = Math.sqrt(dx * dx + dy * dy);
        updateSidebar(tempCore);
        drawCores();
      }
    } else {
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
    }
  });

  canvas.addEventListener("mouseup", (event) => {
    if (currentMode === "add") {
      if (isDraggingTempCore) {
        isDraggingTempCore = false;
      }
    } else {
      if (selectedIndex !== null) {
        updateSidebar(window.sortedCoresData[selectedIndex]); // Update sidebar on mouseup
      }
      isDragging = false;
    }
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
      if (currentMode === "edit" && selectedIndex !== null) {
        const core = window.sortedCoresData[selectedIndex];

        const oldRow = core.row;
        core.row =
          parseInt(
            document.getElementById(currentMode + "RowInput").value,
            10
          ) - 1;
        core.col =
          parseInt(
            document.getElementById(currentMode + "ColumnInput").value,
            10
          ) - 1;
        core.x = parseFloat(
          document.getElementById(currentMode + "XInput").value
        );
        core.y = parseFloat(
          document.getElementById(currentMode + "YInput").value
        );
        core.currentRadius = parseFloat(
          document.getElementById(currentMode + "RadiusInput").value
        );
        core.annotations = document.getElementById(
          currentMode + "AnnotationsInput"
        ).value;

        // Update the isImaginary property based on which radio button is checked
        core.isImaginary = document.getElementById(
          currentMode + "ImaginaryInput"
        ).checked;

        if (document.getElementById("addAutoUpdateColumnsCheckbox").checked) {
          updateColumnsInRowAfterModification(core.row);
          updateColumnsInRowAfterModification(oldRow);

        }

        drawCores(); // Redraw the cores with the updated data
      }
    });

  // Function to clear the temporary core
  function clearTempCore() {
    tempCore = null;
    isSettingSize = false;
    drawCores();
  }

  function updateColumnsInRowAfterModification(row) {
    const imageRotation = parseFloat(
      document.getElementById("originAngle").value
    );

    // Function to rotate a point around the origin
    function rotatePoint(x, y, angle) {
      const radians = (angle * Math.PI) / 180;
      return {
        x: x * Math.cos(radians) - y * Math.sin(radians),
        y: x * Math.sin(radians) + y * Math.cos(radians),
      };
    }

    // Create an array to hold the original cores with their rotated coordinates for sorting
    const coresWithRotatedCoordinates = window.sortedCoresData
      .filter((core) => core.row === row)
      .map((core) => {
        return {
          originalCore: core,
          rotatedCoordinates: rotatePoint(core.x, core.y, imageRotation),
        };
      });

    // Sort the array based on the x-value of the rotated coordinates
    coresWithRotatedCoordinates.sort(
      (a, b) => a.rotatedCoordinates.x - b.rotatedCoordinates.x
    );

    // Assign column values based on the sorted array, updating only the column in the original data
    let currentColumn = 0;
    coresWithRotatedCoordinates.forEach((item) => {
      item.originalCore.col = currentColumn;
      currentColumn++;
    });
  }

  document
    .getElementById("addCoreButton")
    .addEventListener("click", function () {
      if (currentMode === "add" && tempCore) {
        // Add the temporary core to sortedCoresData
        tempCore.row =
          parseInt(document.getElementById("addRowInput").value, 10) - 1;
        tempCore.col =
          parseInt(document.getElementById("addColumnInput").value, 10) - 1;
        tempCore.x = parseFloat(document.getElementById("addXInput").value);
        tempCore.y = parseFloat(document.getElementById("addYInput").value);
        tempCore.currentRadius = parseFloat(
          document.getElementById("addRadiusInput").value
        );
        tempCore.annotations = document.getElementById(
          "addAnnotationsInput"
        ).value;
        tempCore.isImaginary =
          document.getElementById("addImaginaryInput").checked;
        tempCore.isTemporary = false; // Set the temporary flag to false

        window.sortedCoresData.push(tempCore);

        if (document.getElementById("editAutoUpdateColumnsCheckbox").checked) {
          updateColumnsInRowAfterModification(tempCore.row);
        }
        tempCore = null;
        drawCores(); // Redraw to update the canvas
      }
    });

  function updateCoreSize(event) {
    const dx = event.offsetX - tempCore.x;
    const dy = event.offsetY - tempCore.y;
    tempCore.currentRadius = Math.sqrt(dx * dx + dy * dy);
  }

  function finalizeCoreSize(event) {
    updateCoreSize(event);
    isSettingSize = false;
  }
  // Function to cancel the drawing of the current core and reset for a new one
  function cancelCoreDrawing() {
    tempCore = null;
    isSettingSize = false;
    updateSidebar(null);
    drawCores();
  }

  // Event listener for the cancel core drawing button
  document
    .getElementById("cancelCoreDrawing")
    .addEventListener("click", cancelCoreDrawing);

  var coreCanvasElement = document.getElementById("coreCanvas");

  // Add event listeners for mode switching buttons (assumes buttons exist in your HTML)
  // Call clearTempCore when necessary, such as when switching modes
  document.getElementById("switchToEditMode").addEventListener("click", (event) => {
    event.target.classList.add("active");
    document.getElementById("switchToAddMode").classList.remove("active");
    switchMode("edit");
    isSettingSize = false;
    clearTempCore();
    // Add 'edit-mode' class and remove 'add-mode' class
    coreCanvasElement.classList.add("edit-mode");
    coreCanvasElement.classList.remove("add-mode");
  });

  document.getElementById("switchToAddMode").addEventListener("click", (event) => {
    event.target.classList.add("active");
    document.getElementById("switchToEditMode").classList.remove("active");
    switchMode("add");
    isSettingSize = false;
    clearTempCore();
    // Add 'add-mode' class and remove 'edit-mode' class
    coreCanvasElement.classList.add("add-mode");
    coreCanvasElement.classList.remove("edit-mode");
  });

  document
    .getElementById("removeCoreButton")
    .addEventListener("click", function () {
      const currentTime = Date.now();
      if (currentTime - lastActionTime > actionDebounceInterval) {
        if (selectedIndex !== null) {
          const coreToRemove = window.sortedCoresData[selectedIndex];
          window.sortedCoresData.splice(selectedIndex, 1); // Remove the selected core from the array
          selectedIndex = null; // Reset the selected index
          updateSidebar(null); // Update the sidebar to reflect no selection
          if (document.getElementById("addAutoUpdateColumnsCheckbox").checked) {
            updateColumnsInRowAfterModification(coreToRemove.row);
          }
          drawCores(); // Redraw the cores
        }
        lastActionTime = currentTime;
      }
    });

  // Function to toggle the disabled state based on the checkbox
  function toggleColumnInput() {
    var editAutoUpdateColumnsCheckbox = document.getElementById(
      currentMode + "AutoUpdateColumnsCheckbox"
    );
    var columnInput = document.getElementById(currentMode + "ColumnInput");

    // If the checkbox is checked, disable the column input
    if (editAutoUpdateColumnsCheckbox.checked) {
      columnInput.disabled = true;
    } else {
      // Otherwise, enable it
      columnInput.disabled = false;
    }
  }
  document
    .getElementById("editAutoUpdateColumnsCheckbox")
    .addEventListener("change", toggleColumnInput);
  document
    .getElementById("addAutoUpdateColumnsCheckbox")
    .addEventListener("change", toggleColumnInput);
}

async function applyAndVisualizeTravelingAlgorithm() {
  if (window.preprocessedCores) {
    console.log(window.preprocessedCores.length);
    await runTravelingAlgorithm(
      window.preprocessedCores,
      getHyperparametersFromUI()
    );



    drawCoresOnCanvasForTravelingAlgorithm();
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
  const imageFile = window.loadedImg
      ? window.loadedImg.src
      : document.getElementById("fileInput").files.length > 0
      ? URL.createObjectURL(document.getElementById("fileInput").files[0])
      : "path/to/default/image.jpg";

  if (imageFile && window.preprocessedCores) {
    drawCoresOnCanvasForTravelingAlgorithm();
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
