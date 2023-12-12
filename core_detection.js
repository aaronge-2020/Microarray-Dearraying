// Load the model from the web server where the model.json and group1-shard1of1.bin files are located

import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.14.0/+esm";
import * as cv from "https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/+esm";

async function loadModel(modelUrl) {
  try {
    const model = await tf.loadLayersModel(modelUrl);
    return model;
    console.log('Model loaded successfully');
    // You can now use the `model` object to make predictions, evaluate the model, etc.
  } catch (error) {
    console.error('Error loading the model', error);
  }
}

// Make sure to load OpenCV.js in your HTML before this script runs
function watershedAlgorithm(src, min_area, max_area, dis_transform_multiplier = 0.6) {
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
    cv.threshold(dist_transform, sure_fg, dis_transform_multiplier * Math.max(...dist_transform.data), 255, cv.THRESH_BINARY);
  
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
        let centroidX = region.points.reduce((sum, p) => sum + p.x, 0) / region.area;
        let centroidY = region.points.reduce((sum, p) => sum + p.y, 0) / region.area;
        filteredProperties[label] = {
          'center': [centroidX, centroidY],
          'area': region.area
        };
      }
    });
  
    gray.delete(); opening.delete(); sure_bg.delete(); dist_transform.delete(); sure_fg.delete(); unknown.delete(); markers.delete();
    return filteredProperties;
  }
  


export{
    loadModel,
    watershedAlgorithm
}