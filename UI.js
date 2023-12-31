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

// Pure function to update HTML element properties
const updateElementProperty = (element, property, value) => {
  element[property] = value;
};

function updateStatusMessage(elementId, message, statusType) {
  const statusElement = document.getElementById(elementId);
  statusElement.className = `load-status ${statusType}`; // Apply the corresponding class
  statusElement.textContent = message; // Set the text message
}

// Function to highlight the active tab
function highlightTab(activeTab) {
  // Remove active class from all tabs
  document.querySelectorAll(".tablinks").forEach((tab) => {
    tab.classList.remove("active");
  });
  // Add active class to the clicked tab
  activeTab.classList.add("active");
}

// Function to show raw data sidebar
function showRawDataSidebar() {
  document.getElementById("rawDataSidebar").style.display = "block";
  document.getElementById("imageSegmentationSidebar").style.display = "none";
  document.getElementById("virtualGridSidebar").style.display = "none";
}

// Function to show virtual grid sidebar
function showVirtualGridSidebar() {
  document.getElementById("rawDataSidebar").style.display = "none";
  document.getElementById("imageSegmentationSidebar").style.display = "none";
  document.getElementById("virtualGridSidebar").style.display = "block";
}

// Function to show virtual grid sidebar
function showImageSegmentationSidebar() {
  document.getElementById("rawDataSidebar").style.display = "none";
  document.getElementById("imageSegmentationSidebar").style.display = "block";
  document.getElementById("virtualGridSidebar").style.display = "none";
}

function openEditSidebar(row, col, annotation) {
  document.getElementById("rowInput").value = row;
  document.getElementById("columnInput").value = col;
  document.getElementById("annotationInput").value = annotation;
  document.getElementById("editSidebar").style.display = "block";
}

function resetSlidersAndOutputs() {
  // Reset Image Parameters
  document.getElementById("userRadius").value = 20;
  document.getElementById("radiusValue").textContent = "20";

  document.getElementById("xOffset").value = 0;
  document.getElementById("xOffsetValue").textContent = "0";

  document.getElementById("yOffset").value = 0;
  document.getElementById("yOffsetValue").textContent = "0";

  // Reset Traveling Algorithm Parameters
  document.getElementById("originAngle").value = 0;

  document.getElementById("radiusMultiplier").value = 0.7;

  // Assuming the gridWidth is used elsewhere and should be reset to its default
  document.getElementById("gridWidth").value = 70;

  document.getElementById("gamma").value = 60;

  document.getElementById("multiplier").value = 1.5;

  document.getElementById("imageWidth").value = 1024;

  // Assuming the searchAngle is used elsewhere and should be reset to its default
  document.getElementById("searchAngle").value = 360;

  // Reset Edge Detection Parameters
  document.getElementById("thresholdMultiplier").value = 1.5;

  document.getElementById("thresholdAngle").value = 10;

  // Reset Image Rotation Parameters
  document.getElementById("minAngle").value = 0;

  document.getElementById("maxAngle").value = 360;

  document.getElementById("angleStepSize").value = 5;

  document.getElementById("angleThreshold").value = 20;

  // Reset Virtual Grid Configuration
  document.getElementById("horizontalSpacing").value = 50;
  document.getElementById("horizontalSpacingValue").textContent = "50";

  document.getElementById("verticalSpacing").value = 50;
  document.getElementById("verticalSpacingValue").textContent = "50";

  document.getElementById("startingX").value = 50;
  document.getElementById("startingXValue").textContent = "50";

  document.getElementById("startingY").value = 50;
  document.getElementById("startingYValue").textContent = "50";
}
function resetApplication() {
  // Clear the canvases
  const coreCanvas = document.getElementById("coreCanvas");
  const virtualGridCanvas = document.getElementById("virtualGridCanvas");

  // Clear the image element with the id processedImage
  const segmentationResultsCanvas = document.getElementById("segmentationResultsCanvas");

  const coreCtx = coreCanvas.getContext("2d");
  const virtualCtx = virtualGridCanvas.getContext("2d");
  const segmentationResultsCtx = segmentationResultsCanvas.getContext("2d");

  coreCtx.clearRect(0, 0, coreCanvas.width, coreCanvas.height);
  virtualCtx.clearRect(0, 0, virtualGridCanvas.width, virtualGridCanvas.height);
  segmentationResultsCtx.clearRect(0, 0, segmentationResultsCanvas.width, segmentationResultsCanvas.height);
  segmentationResultsCanvas.height = 0;

  // Reset the data structures that hold the core data
  window.preprocessedCores = [];
  window.sortedCoresData = [];
  window.loadedImg = null;
  window.preprocessingData = null;

  // Reset sliders and output elements to their default values
  // resetSlidersAndOutputs();
}

// Main function to update visualization
const updateSliderUIText = (state) => {
  updateElementProperty(
    document.getElementById("thresholdValue"),
    "textContent",
    parseFloat(document.getElementById("thresholdSlider").value).toFixed(2)
  );

  updateElementProperty(
    document.getElementById("maskAlphaValue"),
    "textContent",
    parseFloat(document.getElementById("maskAlphaSlider").value).toFixed(2)
  );
};

export {
  getHyperparametersFromUI,
  updateStatusMessage,
  highlightTab,
  showRawDataSidebar,
  showVirtualGridSidebar,
  showImageSegmentationSidebar,
  resetSlidersAndOutputs,
  resetApplication,
  updateSliderUIText,
};
