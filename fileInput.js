import { getHyperparametersFromUI, resetApplication } from "./UI.js";
import { loadDataAndDetermineParams } from "./data_processing.js";
import { applyAndVisualize } from "./drawCanvas.js";
import { preprocessCores } from "./delaunay_triangulation.js";

// Function to handle loading JSON from URL parameter
async function loadJSONFromURL(url) {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error("Error loading JSON from URL:", error);
      return null;
    }
  }
  
  // Function to initiate the pipeline with data from the URL
  async function initFromURL() {
    resetApplication();
  
    const urlParams = new URLSearchParams(window.location.search);
    const fileURL = urlParams.get("json"); // Assuming the URL parameter is named 'json'
  
    if (fileURL) {
      const jsonData = await loadJSONFromURL(fileURL);
      window.cores = preprocessCores(jsonData);
  
      if (jsonData) {
        // Assuming you have a function to setup UI values or something similar
        await loadDataAndDetermineParams(
          window.cores,
          getHyperparametersFromUI()
        );
  
        applyAndVisualize();
      }
    }
  }

  function handleFileLoad(event) {
    try {
      // Parse the uploaded file and preprocess the coresf
      window.cores = preprocessCores(JSON.parse(event.target.result));
  
      loadDataAndDetermineParams(window.cores, getHyperparametersFromUI());
  
      updateStatusMessage("jsonLoadStatus",
        "JSON loaded successfully.",
        "success-message"
      );
  
    } catch (error) {
      
        updateStatusMessage("jsonLoadStatus",
        "Error loading JSON.",
        "error-message"
      );
  
      console.error("Error processing file:", error);
    }
  }
  
  function handleFileSelect(event) {
    resetApplication();
  
    const reader = new FileReader();
    reader.onload = handleFileLoad; // Set the event handler for when the file is read
    reader.readAsText(event.target.files[0]); // Read the selected file as text
  }

  
  export{
    loadJSONFromURL,
    initFromURL,
    handleFileLoad,
    handleFileSelect
  }