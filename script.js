import {
  loadModel,
  watershedAlgorithm,
  preprocessAndPredict,
  processAndVisualizeImage,
  visualizePredictions,
} from "./core_detection.js";

// Main event listener for file upload
const fileInput = document.getElementById("fileInput");
const thresholdSlider = document.getElementById("thresholdSlider");
const thresholdValueDisplay = document.getElementById("thresholdValue");
const originalImageContainer = document.getElementById("originalImage");
const processedImageContainer = document.getElementById("processedImage");
let currentThreshold = parseFloat(thresholdSlider.value);

const model = await loadModel("./tfjs_model/model.json");

fileInput.addEventListener("change", async function (e) {
  const file = e.target.files[0];
  if (file && file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = async function (event) {
      const img = new Image();
      img.onload = async function () {
        // Display the original image
        originalImageContainer.src = event.target.result;

        // Visualize the predictions
        await processAndVisualizeImage(
          model,
          originalImageContainer,
          processedImageContainer,
          currentThreshold
        );
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});
// Update the threshold value display and re-process the image when the slider is moved
thresholdSlider.addEventListener("input", function () {
  currentThreshold = parseFloat(this.value);
  thresholdValueDisplay.textContent = currentThreshold.toFixed(2);
  // Re-process the last uploaded image with the new threshold if it's already loaded
  if (originalImageContainer.src !== "#") {
    processAndVisualizeImage(
      model,
      originalImageContainer,
      processedImageContainer,
      currentThreshold
    );
  }
});

// Add drag and drop functionality (optional)
const label = document.querySelector(".file-input-label");
label.ondragover = label.ondragenter = function (evt) {
  evt.preventDefault();
};

label.ondrop = function (evt) {
  evt.preventDefault();
  fileInput.files = evt.dataTransfer.files;
  fileInput.dispatchEvent(new Event("change"));
};
