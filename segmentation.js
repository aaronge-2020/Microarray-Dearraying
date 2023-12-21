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
  outputCanvas
) => {
  runPipeline(
    originalImage,
    model,
    threshold,
    minArea,
    maxArea,
    disTransformMultiplier,
    outputCanvas
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
const updateVisualization = (state) => {
  const threshold = parseFloat(getInputValue("thresholdSlider"));
  updateElementProperty(
    document.getElementById("thresholdValue"),
    "textContent",
    threshold.toFixed(2)
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
      processedImageCanvas
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
        updateVisualization(state);
      };

  } else {
    console.error("Please enter a valid image URL");
  }
};

// Initialize and bind events
const initApp = async () => {
  const state = await loadDependencies();

  document
    .getElementById("fileInput")
    .addEventListener("change", (e) =>
      handleFileInputChange(e, () => updateVisualization(state))
    );
  document
    .getElementById("loadImageUrlBtn")
    .addEventListener("click", () => handleLoadImageUrlClick(state));

  ["input", "change"].forEach((event) => {
    document
      .getElementById("thresholdSlider")
      .addEventListener(event, () => updateVisualization(state));
    document
      .getElementById("minAreaInput")
      .addEventListener(event, () => updateVisualization(state));
    document
      .getElementById("maxAreaInput")
      .addEventListener(event, () => updateVisualization(state));
    document
      .getElementById("disTransformMultiplierInput")
      .addEventListener(event, () => updateVisualization(state));
  });

};

// Run the app
initApp();
