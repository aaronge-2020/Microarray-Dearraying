import { loadModel, runPipeline, loadOpenCV } from "./core_detection.js";

// Main event listener for file upload
const fileInput = document.getElementById("fileInput");
const thresholdSlider = document.getElementById("thresholdSlider");
const thresholdValueDisplay = document.getElementById("thresholdValue");
const minAreaInput = document.getElementById("minAreaInput");
const maxAreaInput = document.getElementById("maxAreaInput");
const disTransformMultiplierInput = document.getElementById(
  "disTransformMultiplierInput"
);
const originalImageContainer = document.getElementById("originalImage");
const processedImageCanvas = document.getElementById("processedImage");
processedImageCanvas.width = 512; // Set this to the desired value
processedImageCanvas.height = 512; // Set this to the desired value

const model = await loadModel("./tfjs_model/model.json");

loadOpenCV();

// Event listeners for input changes
thresholdSlider.addEventListener("input", updateVisualization);
minAreaInput.addEventListener("change", updateVisualization);
maxAreaInput.addEventListener("change", updateVisualization);
disTransformMultiplierInput.addEventListener("change", updateVisualization);

// Function to update visualization based on input changes
function updateVisualization() {
  const threshold = parseFloat(thresholdSlider.value);
  thresholdValueDisplay.textContent = threshold.toFixed(2);
  if (
    originalImageContainer.src[originalImageContainer.src.length - 1] !== "#"
  ) {
    const minArea = parseInt(minAreaInput.value, 10);
    const maxArea = parseInt(maxAreaInput.value, 10);
    const disTransformMultiplier = parseFloat(
      disTransformMultiplierInput.value
    );
    runPipeline(
      originalImageContainer,
      model,
      threshold,
      minArea,
      maxArea,
      disTransformMultiplier,
      processedImageCanvas
    );
  }
}

fileInput.addEventListener("change", async function (e) {
  const file = e.target.files[0];
  if (file && file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = async function (event) {
      originalImageContainer.onload = async function () {
        // Once the image is loaded, run the full pipeline
        updateVisualization();
      };
      originalImageContainer.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});


// Event listener for the 'Load Image from URL' button
document
  .getElementById("loadImageUrlBtn")
  .addEventListener("click", function () {
    const imageUrl = document.getElementById("imageUrlInput").value;

    if (imageUrl) {
      // Create a new Image object
      const image = new Image();

      // Once the image is loaded, run the full pipeline
      image.onload = async function () {
        // Set the originalImageContainer's source to the loaded image's source
        originalImageContainer.src = this.src;

        // Run the pipeline with the new image
        updateVisualization();
      };

      // Handle any errors that occur during loading
      image.onerror = function () {
        console.error("Failed to load image from URL.");
      };

      // Set the source of the image to the provided URL
      image.src = imageUrl;
    } else {
      console.error("Please enter a valid image URL");
    }
  });

// Append the canvas to your image container
document.querySelector(".image-container").appendChild(processedImageCanvas);

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

document.getElementById("downloadBtn").addEventListener("click", function () {
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


window.addEventListener('load', function() {
    // This will be executed after the page is fully loaded
    const urlParams = new URLSearchParams(window.location.search);
    const imageUrl = urlParams.get('image');
    if (imageUrl) {
      loadImageAndRunPipeline(imageUrl);
    }
  });
  
  function loadImageAndRunPipeline(imageUrl) {
    // Create a new Image object
    const image = new Image();
    // Set CORS to anonymous to access the image data if CORS headers are set on the image server
    image.crossOrigin = "anonymous";
    
    // Once the image is loaded, run the full pipeline
    image.onload = async function() {
      // Assuming originalImageContainer is defined earlier in your code and accessible here
      originalImageContainer.src = this.src;
      updateVisualization(); // Make sure this function is defined and does what's expected
    };
  
    // Handle any errors that occur during loading
    image.onerror = function() {
      console.error('Failed to load image from URL.');
      if (document.getElementById('notification')) {
        document.getElementById('notification').textContent = 'Failed to load image from URL. Please check the URL and try again.';
      }
    };
  
    // Set the source of the image to the provided URL
    image.src = imageUrl;
  }
