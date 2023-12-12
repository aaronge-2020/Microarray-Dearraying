// Load the model from the web server where the model.json and group1-shard1of1.bin files are located

import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.14.0/+esm";
// import * as cv from "https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/+esm";

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

// Make sure to load OpenCV.js in your HTML before this script runs
function watershedAlgorithm(
  src,
  min_area,
  max_area,
  dis_transform_multiplier = 0.6
) {
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

  let opening = new cv.Mat();
  let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  let sure_bg = new cv.Mat();
  let dist_transform = new cv.Mat();
  let sure_fg = new cv.Mat();
  let unknown = new cv.Mat();
  let markers = new cv.Mat();

  // Noise removal with opening
  cv.morphologyEx(gray, opening, cv.MORPH_OPEN, kernel);

  // Sure background area (dilation enlarges the regions)
  cv.dilate(opening, sure_bg, kernel, new cv.Point(-1, -1), 3);

  // Finding sure foreground area
  cv.distanceTransform(opening, dist_transform, cv.DIST_L2, 5);
  cv.threshold(
    dist_transform,
    sure_fg,
    dis_transform_multiplier * Math.max(...dist_transform.data),
    255,
    cv.THRESH_BINARY
  );

  // Finding unknown region
  cv.subtract(sure_bg, sure_fg, unknown);

  // Marker labelling
  cv.connectedComponents(sure_fg, markers);

  // Add one to all labels so that sure background is not 0, but 1
  markers.convertTo(markers, cv.CV_32S); // Convert markers to 32S type for watershed

  // Now, mark the region of unknown with zero
  unknown.convertTo(unknown, cv.CV_8U);
  for (let i = 0; i < markers.rows; i++) {
    for (let j = 0; j < markers.cols; j++) {
      if (unknown.ucharPtr(i, j)[0] === 255) {
        markers.intPtr(i, j)[0] = 0;
      }
    }
  }

  // Watershed algorithm
  cv.watershed(src, markers);

  // Calculate properties for each region.
  let properties = {};
  for (let i = 0; i < markers.rows; i++) {
    for (let j = 0; j < markers.cols; j++) {
      let regionLabel = markers.intPtr(i, j)[0];
      // Skip background and border regions
      if (regionLabel === -1 || regionLabel === 1) {
        continue;
      }

      if (!(regionLabel in properties)) {
        properties[regionLabel] = { area: 0, points: [] };
      }

      properties[regionLabel].area++;
      properties[regionLabel].points.push({ x: j, y: i });
    }
  }

  // Filtering regions based on area
  let filteredProperties = {};
  Object.keys(properties).forEach((label) => {
    let region = properties[label];
    if (region.area >= min_area && region.area <= max_area) {
      let centroidX =
        region.points.reduce((sum, p) => sum + p.x, 0) / region.area;
      let centroidY =
        region.points.reduce((sum, p) => sum + p.y, 0) / region.area;
      filteredProperties[label] = {
        center: [centroidX, centroidY],
        area: region.area,
      };
    }
  });

  gray.delete();
  opening.delete();
  sure_bg.delete();
  dist_transform.delete();
  sure_fg.delete();
  unknown.delete();
  markers.delete();
  return filteredProperties;
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

  // Convert predictions to image data
  const maskImageData = await tf.tidy(() => {
    // Clip the predictions to ensure they are between 0 and 1
    const clippedPredictions = predictions.clipByValue(0, 1);
    // Resize the predictions to match the original image size
    const resizedPredictions = tf.image.resizeBilinear(clippedPredictions, [
      height,
      width,
    ]);
    // Convert the tensor to data for visualization
    return tf.browser.toPixels(resizedPredictions.squeeze());
  });

  // Put the mask data into an ImageData object
  const imageData = new ImageData(maskImageData, width, height);

  // Draw the mask on top of the original image
  ctx.putImageData(imageData, 0, 0);

  // Set the source of the container to the canvas data
  container.src = canvas.toDataURL();

  // Dispose predictions to free memory
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
}

export {
  loadModel,
  watershedAlgorithm,
  preprocessAndPredict,
  processAndVisualizeImage,
  visualizePredictions,
};
