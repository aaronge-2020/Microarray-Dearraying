import { preprocessCores } from "./delaunay_triangulation.js";

import {
  getHyperparametersFromUI,
  showRawDataSidebar,
  showVirtualGridSidebar,
  updateStatusMessage,
  highlightTab,
  resetApplication,
} from "./UI.js";

import {
  loadDataAndDetermineParams,
  saveUpdatedCores,
} from "./data_processing.js";

import {
  drawCoresOnCanvas,
  applyAndVisualize,
  updateVirtualGridSpacing,
  redrawCores,
} from "./drawCanvas.js";

import { handleFileSelect, initFromURL, loadJSONFromURL } from "./fileInput.js";

// Helper function to create a DOM element selector
const selectElement = (id) => document.getElementById(id);

// Helper function to set innerHTML
const setInnerHtml = (id, html) => {
  const element = selectElement(id);
  element.innerHTML = html;
};

function bindEventListeners() {
  // Call initFromURL when the window loads
  window.addEventListener("load", initFromURL);

  document.getElementById("loadJsonBtn").addEventListener("click", async () => {
    resetApplication();

    setInnerHtml("jsonLoadStatus", "<div class='spinner'></div>");

    const jsonUrl = document.getElementById("jsonUrlInput").value;

    let jsonData = null;
    try {
      jsonData = await loadJSONFromURL(jsonUrl);

      updateStatusMessage(
        "jsonLoadStatus",
        "JSON Loaded Successfully",
        "success-message"
      );
    } catch (error) {
      updateStatusMessage(
        "jsonLoadStatus",
        "Error Loading JSON",
        "error-message"
      );

      console.error("Error loading JSON from URL:", error);
    }
    window.cores = preprocessCores(jsonData);
    await loadDataAndDetermineParams(window.cores, getHyperparametersFromUI());

    // Update the URL with the loaded JSON
    // window.history.replaceState(
    //   {},
    //   "",
    //   `${window.location.pathname}?json=${jsonUrl}`
    // );
  });

  // Updated function to load an image from a URL
  document.getElementById("loadImgBtn").addEventListener("click", async () => {
    const imgUrl = document.getElementById("imgUrlInput").value;
    if (!imgUrl) {
      console.error("No image URL provided.");
      return;
    }

    setInnerHtml("imageLoadStatus", "<div class='spinner'></div>");

    const image = new Image();
    image.src = imgUrl;
    image.onload = async () => {
      // Save the loaded image globally
      window.loadedImg = image;
      if (window.cores && window.cores.length > 0) {
        updateStatusMessage(
          "imageLoadStatus",
          "Image loaded successfully.",
          "success-message"
        );
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
          imgUrl,
          window.cores,
          window.preprocessingData.minX,
          window.preprocessingData.minY
        );
      } else {
        alert("Please load the JSON file first.");
      }
    };

    image.onerror = () => {
      updateStatusMessage(
        "imageLoadStatus",
        "Image failed to load.",
        "error-message"
      );

      console.error("Image failed to load from the provided URL.");
    };
  });

  document
    .getElementById("fileInput")
    .addEventListener("change", handleFileSelect, false); // Attach the event listener to the file input

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

  document
    .getElementById("imageInput")
    .addEventListener("change", function (event) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const imageSrc = e.target.result;
        // Check if cores data is available before drawing
        if (window.cores && window.cores.length > 0) {
          updateStatusMessage(
            "imageLoadStatus",
            "Image Loaded Successfully",
            "success-message"
          );

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
            imageSrc,
            window.cores,
            window.preprocessingData.minX,
            window.preprocessingData.minY
          );
        } else {
          alert("Please load the JSON file first.");
        }
      };
      reader.onerror = function (e) {
        updateStatusMessage(
          "imageLoadStatus",
          "Error Loading Image",
          "error-message"
        );

        console.error("Error loading image:", e);
      };

      reader.readAsDataURL(event.target.files[0]);
    });
  document.getElementById("userRadius").addEventListener("input", function () {
    const radiusValue = document.getElementById("radiusValue");
    const userRadius = document.getElementById("userRadius").value;
    radiusValue.value = userRadius; // Update the output element with the slider value

    const imageFile = document.getElementById("imageInput").files[0];
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

// Main function that runs the application
const run = async () => {
  bindEventListeners();
};

run();