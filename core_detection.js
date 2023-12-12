// Load the model from the web server where the model.json and group1-shard1of1.bin files are located

import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.14.0/+esm";

function loadOpenCV() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.min.js";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (cv.getBuildInformation) {
        console.log("OpenCV.js is ready.");
        resolve("OpenCV Loaded");
      } else {
        reject("OpenCV.js is loaded but not ready to use.");
      }
    };

    script.onerror = () => {
      reject("Failed to load OpenCV.js");
    };

    document.body.appendChild(script);
  });
}

async function loadModel(modelUrl) {
  try {
    const model = await tf.loadLayersModel(modelUrl);
    console.log("Model loaded successfully");

    return model;
    // You can now use the `model` object to make predictions, evaluate the model, etc.
  } catch (error) {
    console.error("Error loading the model", error);
  }
}



function calculateCentroids(markers, minArea, maxArea) {
  let regions = {};
  
  // Iterate through each pixel in the markers matrix
  for (let i = 0; i < markers.rows; i++) {
      for (let j = 0; j < markers.cols; j++) {
          let label = markers.intPtr(i, j)[0];
          if (label === 0) continue; // Skip the background

          if (!(label in regions)) {
              regions[label] = { xSum: 0, ySum: 0, count: 0 };
          }

          regions[label].xSum += j;
          regions[label].ySum += i;
          regions[label].count += 1;
      }
  }

  let centroids = {};
  for (let label in regions) {
      let region = regions[label];
      let area = region.count;
      if (area >= minArea && area <= maxArea) {
          centroids[label] = {
              x: region.xSum / area,
              y: region.ySum / area, 
              radius: Math.sqrt(area / Math.PI), // radius
          };
      }
  }

  return centroids;
}

function getMaxValue(mat) {
  let maxVal = 0;
  for (let i = 0; i < mat.rows; i++) {
    for (let j = 0; j < mat.cols; j++) {
      let val = mat.floatPtr(i, j)[0];
      if (val > maxVal) {
        maxVal = val;
      }
    }
  }
  return maxVal;
}


function segmentationAlgorithm(data, minArea, maxArea, disTransformMultiplier = 0.6) {

      // Convert to grayscale if the image is not already
      let gray = new cv.Mat();
      if (data.channels() === 3 || data.channels() === 4) {
          cv.cvtColor(data, gray, cv.COLOR_RGBA2GRAY, 0);
      } else {
          gray = src.clone();
      }
  
      // Convert to binary image
      let binary = new cv.Mat();
      cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

      
  // Noise removal with opening
  let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  let opening = new cv.Mat();
  cv.morphologyEx(binary, opening, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 2);

  // Sure background area
  let sureBg = new cv.Mat();
  cv.dilate(opening, sureBg, kernel, new cv.Point(-1, -1), 3);

  // Finding sure foreground area
  let distTransform = new cv.Mat();
  cv.distanceTransform(opening, distTransform, cv.DIST_L2, 5);
  let sureFg = new cv.Mat();
  // Then use it in your threshold call
  let maxVal = getMaxValue(distTransform);
  cv.threshold(distTransform, sureFg, disTransformMultiplier * maxVal, 255, 0);

  // Finding unknown region
  sureFg.convertTo(sureFg, cv.CV_8U);
  let unknown = new cv.Mat();
  cv.subtract(sureBg, sureFg, unknown);

  // Marker labelling
  let markers = new cv.Mat();
  cv.connectedComponents(sureFg, markers);

  // Add one to all labels so that sure background is not 0, but 1
  let markersAdjusted = new cv.Mat();
  cv.add(markers, new cv.Mat(markers.rows, markers.cols, markers.type(), new cv.Scalar(1)), markersAdjusted);

  // Now, mark the region of unknown with zero
  for (let i = 0; i < markersAdjusted.rows; i++) {
      for (let j = 0; j < markersAdjusted.cols; j++) {
          if (unknown.ucharAt(i, j) === 255) {
              markersAdjusted.ucharPtr(i, j)[0] = 0;
          }
      }
  }

  // Calculate properties for each region
  let properties = calculateCentroids(markersAdjusted, minArea, maxArea);

  // Cleanup
  opening.delete();
  sureBg.delete();
  distTransform.delete();
  sureFg.delete();
  unknown.delete();
  markers.delete();
  markersAdjusted.delete();

  return properties;
}

// Preprocess and predict function
async function preprocessAndPredict(imageElement, model) {
  // Create a canvas to manipulate the image
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 512;
  canvas.height = 512;

  // Draw the image onto the canvas and resize it
  ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

  // Convert the image data to a TensorFlow Tensor and normalize it
  let tensor = tf.browser
    .fromPixels(canvas)
    .toFloat()
    .div(tf.scalar(255))
    .expandDims(); // Add the batch dimension

  // Predict the mask from the model
  const predictions = await model.predict(tensor);

  // Dispose of the tensor to free memory
  tensor.dispose();

  // Return the predictions Tensor for further processing
  return predictions;
}

// Visualization function
async function visualizePredictions(originalImage, predictions, container) {
  const [width, height] = [originalImage.width, originalImage.height];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;

  // Draw the original image onto the canvas
  ctx.drawImage(originalImage, 0, 0, width, height);

  // Process predictions outside of tf.tidy
  const clippedPredictions = predictions.clipByValue(0, 1);
  const resizedPredictions = await tf.image.resizeBilinear(clippedPredictions, [
    height,
    width,
  ]);
  const squeezedPredictions = resizedPredictions.squeeze();
  const maskImageData = await tf.browser.toPixels(squeezedPredictions);

  // Dispose of the tensor since toPixels is done
  tf.dispose([clippedPredictions, resizedPredictions, squeezedPredictions]);

  // Create ImageData object with the mask data
  const imageData = new ImageData(maskImageData, width, height);

  // Draw the mask on top of the original image
  ctx.putImageData(imageData, 0, 0);

  // Set the source of the container to the canvas data
  container.src = canvas.toDataURL();

  // Ensure predictions are disposed
  predictions.dispose();
}

// Function to apply the threshold to the predictions
function applyThreshold(predictions, threshold) {
  return predictions.greaterEqual(tf.scalar(threshold)).toFloat();
}

// Function to handle image processing and visualization
async function processAndVisualizeImage(
  model,
  originalImageElement,
  visualizationContainer,
  threshold
) {
  // Preprocess the image and predict
  const predictions = await preprocessAndPredict(originalImageElement, model);
  // Apply the threshold to the predictions
  const thresholdedPredictions = applyThreshold(predictions, threshold);
  // Visualize the predictions
  await visualizePredictions(
    originalImageElement,
    thresholdedPredictions,
    visualizationContainer
  );
  return thresholdedPredictions;
}

function tensorToCvMat(tensor) {
  // Squeeze the tensor to remove dimensions of size 1
  const squeezed = tensor.squeeze();
  const [height, width] = squeezed.shape;
  const data = squeezed.dataSync(); // Get tensor data
  const out = new cv.Mat(height, width, cv.CV_8UC1); // Create a new OpenCV Mat for grayscale image

  // Fill the OpenCV Mat with the tensor data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out.ucharPtr(y, x)[0] = data[y * width + x] * 255;
    }
  }

  // Clean up tensor
  squeezed.dispose();
  let srcMatRgb = new cv.Mat();
  cv.cvtColor(out, srcMatRgb, cv.COLOR_GRAY2RGB);
  return srcMatRgb;
}

// Main function to run the full prediction and visualization pipeline
async function runPipeline(
  imageElement,
  model,
  threshold,
  minArea,
  maxArea,
  disTransformMultiplier,
  visualizationContainer
) {
  // Preprocess the image and predict
  const predictions = await preprocessAndPredict(imageElement, model);
  // Apply the threshold to the predictions
  const thresholdedPredictions = applyThreshold(predictions, threshold);
  // Convert the tensor to a format that OpenCV.js can work with
  const srcMat = tensorToCvMat(thresholdedPredictions);

  // Run the segmentation algorithm to find centers
  const properties = segmentationAlgorithm(
    srcMat,
    minArea,
    maxArea,
    disTransformMultiplier
  );

  window.properties = properties;
  // Visualize the predictions with the centers
  await visualizePredictions(
    imageElement,
    thresholdedPredictions,
    visualizationContainer
  );

  // Then visualize the centers on top of the predictions
  visualizeCenters(properties, visualizationContainer);
}

// Function to visualize centers
function visualizeCenters(properties, imageElement) {
  // Create a temporary canvas
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Set canvas dimensions to match the image
  canvas.width = imageElement.width;
  canvas.height = imageElement.height;

  // Draw the image onto the canvas
  ctx.drawImage(imageElement, 0, 0, imageElement.width, imageElement.height);

  // Draw a red dot at each center
  Object.values(properties).forEach((prop) => {
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
  });

  // Update the original image element if needed
  imageElement.src = canvas.toDataURL();

  // If you don't need to update the original img element, you could append the canvas to the DOM
  // document.body.appendChild(canvas); // Or append it to another element
}

export {
  loadModel,
  segmentationAlgorithm,
  preprocessAndPredict,
  processAndVisualizeImage,
  visualizePredictions,
  runPipeline,
  visualizeCenters,
  loadOpenCV,
};
