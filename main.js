import {
  showRawDataSidebar,
  showVirtualGridSidebar,
  highlightTab,
  showImageSegmentationSidebar,
  getHyperparametersFromUI,
} from "./UI.js";

import { saveUpdatedCores } from "./data_processing.js";

import {
  applyAndVisualize,
  updateVirtualGridSpacing,
  redrawCores,
  drawCoresOnCanvas,
} from "./drawCanvas.js";

import { loadDataAndDetermineParams } from "./data_processing.js";

import { loadModel, runPipeline, loadOpenCV } from "./core_detection.js";

// Initialize image elements
const originalImageContainer = document.getElementById("originalImage");
const processedImageCanvas = document.getElementById("processedImage");

// Pure function to update HTML element properties
const updateElementProperty = (element, property, value) => {
  element[property] = value;
};

// Load dependencies and return updated state
const loadDependencies = async () => ({
  model: await loadModel("./tfjs_model/model.json"),
  openCVLoaded: await loadOpenCV(),
});

// Pure function to get input values
const getInputValue = (inputId) => document.getElementById(inputId).value;

// Function to process image
const processImage = (
  originalImage,
  model,
  threshold,
  minArea,
  maxArea,
  disTransformMultiplier,
  outputCanvas,
  alpha = 0.3
) => {
  runPipeline(
    originalImage,
    model,
    threshold,
    minArea,
    maxArea,
    disTransformMultiplier,
    outputCanvas,
    alpha = alpha
  );
};

// Event handler for file input change
const handleFileInputChange = async (e, processCallback) => {
  const file = e.target.files[0];
  if (file && file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      originalImageContainer.src = event.target.result;
      originalImageContainer.onload = async () => {
        processCallback();
      };
    };
    reader.readAsDataURL(file);
  }
};

// Main function to update visualization
const updateSegmentationVisualization = (state) => {
  const threshold = parseFloat(getInputValue("thresholdSlider"));
  const maskAlpha = parseFloat(getInputValue("maskAlphaSlider"));

  updateElementProperty(
    document.getElementById("thresholdValue"),
    "textContent",
    threshold.toFixed(2)
  );

  updateElementProperty(
    document.getElementById("maskAlphaValue"),
    "textContent",
    maskAlpha.toFixed(2)
  );

  if (
    originalImageContainer.src &&
    originalImageContainer.src[originalImageContainer.src.length - 1] !== "#"
  ) {
    const minArea = parseInt(getInputValue("minAreaInput"), 10);
    const maxArea = parseInt(getInputValue("maxAreaInput"), 10);
    const disTransformMultiplier = parseFloat(
      getInputValue("disTransformMultiplierInput")
    );

    processImage(
      originalImageContainer,
      state.model,
      threshold,
      minArea,
      maxArea,
      disTransformMultiplier,
      processedImageCanvas,
      maskAlpha
    );
  }
};

// Event handler for load image from URL
const handleLoadImageUrlClick = (state) => {
  const imageUrl = getInputValue("imageUrlInput");
  
  if (imageUrl) {
    originalImageContainer.crossOrigin = "anonymous";
    originalImageContainer.src = imageUrl;

    originalImageContainer.onload = async () => {
      window.loadedImg = originalImageContainer;

      updateSegmentationVisualization(state);
    };
  } else {
    console.error("Please enter a valid image URL");
  }
};

function bindEventListeners() {
  // Event listener for the Apply Hyperparameters button
  document
    .getElementById("apply-hyperparameters")
    .addEventListener("click", applyAndVisualize);

  // Add event listeners for range inputs to show the current value
  document
    .getElementById("horizontalSpacing")
    .addEventListener("input", function () {
      document.getElementById("horizontalSpacingValue").textContent =
        this.value;
    });

  document
    .getElementById("verticalSpacing")
    .addEventListener("input", function () {
      document.getElementById("verticalSpacingValue").textContent = this.value;
    });

  // Add event listeners for range inputs to show the current value
  document.getElementById("startingX").addEventListener("input", function () {
    document.getElementById("startingXValue").textContent = this.value;
  });

  document.getElementById("startingY").addEventListener("input", function () {
    document.getElementById("startingYValue").textContent = this.value;
  });

  // Event listeners for tab buttons
  document
    .getElementById("rawDataTabButton")
    .addEventListener("click", function () {
      showRawDataSidebar();
      highlightTab(this); // This function will highlight the active tab, it's implementation is shown below
    });

  document
    .getElementById("imageSegmentationTabButton")
    .addEventListener("click", function () {
      showImageSegmentationSidebar();
      highlightTab(this); // This function will highlight the active tab, it's implementation is shown below
    });

  document
    .getElementById("virtualGridTabButton")
    .addEventListener("click", function () {
      showVirtualGridSidebar();
      highlightTab(this); // This function will highlight the active tab, it's implementation is shown below
    });

  // JavaScript to handle the virtual grid sidebar hyperparameters and update the grid
  document
    .getElementById("applyVirtualGridSettings")
    .addEventListener("click", function () {
      const horizontalSpacing = parseInt(
        document.getElementById("horizontalSpacing").value,
        10
      );
      const verticalSpacing = parseInt(
        document.getElementById("verticalSpacing").value,
        10
      );
      const startingX = parseInt(
        document.getElementById("startingX").value,
        10
      );
      const startingY = parseInt(
        document.getElementById("startingY").value,
        10
      );

      // Update the virtual grid with the new spacing values
      updateVirtualGridSpacing(
        horizontalSpacing,
        verticalSpacing,
        startingX,
        startingY
      );
    });

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

  document.getElementById("userRadius").addEventListener("input", function () {
    const radiusValue = document.getElementById("radiusValue");
    const userRadius = document.getElementById("userRadius").value;
    radiusValue.value = userRadius; // Update the output element with the slider value

    const imageFile = document.getElementById("fileInput").files[0];
    if ((imageFile || window.loadedImg) && window.cores) {
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
}

// Initialize and bind events
const initSegmentation = async () => {
  const state = await loadDependencies();

  document
    .getElementById("fileInput")
    .addEventListener("change", (e) =>
      handleFileInputChange(e, () => updateSegmentationVisualization(state))
    );
  document
    .getElementById("loadImageUrlBtn")
    .addEventListener("click", () => handleLoadImageUrlClick(state));

  ["input", "change"].forEach((event) => {
    document
      .getElementById("thresholdSlider")
      .addEventListener(event, () => updateSegmentationVisualization(state));
    document
      .getElementById("minAreaInput")
      .addEventListener(event, () => updateSegmentationVisualization(state));
    document
      .getElementById("maxAreaInput")
      .addEventListener(event, () => updateSegmentationVisualization(state));
    document
      .getElementById("disTransformMultiplierInput")
      .addEventListener(event, () => updateSegmentationVisualization(state));
      document
      .getElementById("maskAlphaSlider")
      .addEventListener(event, () => updateSegmentationVisualization(state));
  });
  document
    .getElementById("downloadSegmentationResults")
    .addEventListener("click", function () {
      // Assuming `properties` is the variable holding your segmentation results
      if (!window.properties) {
        alert("Algorithm has not run yet!");
        return;
      }

      const propertiesJson = JSON.stringify(window.properties, null, 2);
      const blob = new Blob([propertiesJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "segmentation-properties.json";
      a.click();
      URL.revokeObjectURL(url);
    });

  document
    .getElementById("applySegmentation")
    .addEventListener("click", function () {
      // Assuming `properties` is the variable holding your segmentation results
      if (!window.properties) {
        alert("No image uploaded!");
        return;
      }

      loadDataAndDetermineParams(window.cores, getHyperparametersFromUI());

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
        originalImageContainer.src,
        window.cores,
        window.preprocessingData.minX,
        window.preprocessingData.minY
      );
    });
};

// Main function that runs the application
const run = async () => {
  bindEventListeners();
  // Run the app
  initSegmentation();
};

run();
