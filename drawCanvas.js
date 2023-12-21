import { getHyperparametersFromUI } from "./UI.js";
import { runTravelingAlgorithm } from "./data_processing.js";

function drawCoresOnCanvas(imageSrc, coresData) {
  const img = new Image();
  img.src = imageSrc;

  img.onload = () => {
    const canvas = document.getElementById("coreCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, img.width, img.height);

    const userRadius = parseInt(document.getElementById("userRadius").value);
    const xOffset = parseInt(document.getElementById("xOffset").value);
    const yOffset = parseInt(document.getElementById("yOffset").value);

    if (window.sortedCoresData && window.sortedCoresData.length > 0) {
      // Process sorted data and draw circles with row/col information
      window.sortedCoresData.forEach((sortedCore) => {
        ctx.beginPath();
        ctx.arc(
          sortedCore.x + xOffset,
          sortedCore.y + yOffset,
          userRadius,
          0,
          Math.PI * 2
        );
        ctx.lineWidth = 2;

        // Check if the core is imaginary and set the color accordingly
        if (sortedCore.isImaginary) {
          ctx.strokeStyle = "orange";
        } else {
          ctx.strokeStyle = "red";
        }

        ctx.stroke();

        // Draw row/col information
        ctx.fillStyle = "blue"; // Text color
        ctx.font = "10px Arial"; // Text font and size
        ctx.fillText(
          `(${sortedCore.row},${sortedCore.col})`,
          sortedCore.x + xOffset - userRadius + 2,
          sortedCore.y + yOffset
        );
      });
    } else {
      // Draw only red circles for real cores if sorted data is not available
      coresData.forEach((core) => {
        ctx.beginPath();
        ctx.arc(core.x + xOffset, core.y + yOffset, userRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  };
}
// Updated applyAndVisualize function
async function applyAndVisualize() {
  if (window.cores) {
    await runTravelingAlgorithm(window.cores, getHyperparametersFromUI());

    // Use the loaded image if available, otherwise use default or file input image
    const imageSrc = window.loadedImg
      ? window.loadedImg.src
      : document.getElementById("imageInput").files.length > 0
      ? URL.createObjectURL(document.getElementById("imageInput").files[0])
      : "path/to/default/image.jpg";

    drawCoresOnCanvas(imageSrc, window.cores);

    const horizontalSpacing = parseInt(
      document.getElementById("horizontalSpacing").value,
      10
    );
    const verticalSpacing = parseInt(
      document.getElementById("verticalSpacing").value,
      10
    );
    const startingX = parseInt(document.getElementById("startingX").value, 10);
    const startingY = parseInt(document.getElementById("startingY").value, 10);

    createVirtualGrid(
      imageSrc,
      window.sortedCoresData,
      horizontalSpacing,
      verticalSpacing,
      startingX,
      startingY
    );
  } else {
    console.error("No cores data available. Please load a file first.");
  }
}

function createVirtualGrid(
  imageSrc,
  sortedCoresData,
  horizontalSpacing,
  verticalSpacing,
  startingX,
  startingY
) {
  const virtualGridCanvas = document.getElementById("virtualGridCanvas");
  if (!virtualGridCanvas) {
    console.error("Virtual grid canvas not found");
    return;
  }

  const rows =
    sortedCoresData.reduce((acc, core) => Math.max(acc, core.row), 0) + 1;
  const cols =
    sortedCoresData.reduce((acc, core) => Math.max(acc, core.col), 0) + 1;
  const userRadius = parseInt(document.getElementById("userRadius").value);
  virtualGridCanvas.width =
    cols * horizontalSpacing + userRadius * 2 + startingX;
  virtualGridCanvas.height =
    rows * verticalSpacing + userRadius * 2 + startingY;

  const vctx = virtualGridCanvas.getContext("2d");
  const img = new Image();
  img.src = imageSrc;

  img.onload = () => {
    vctx.clearRect(0, 0, virtualGridCanvas.width, virtualGridCanvas.height);

    sortedCoresData.forEach((core) => {
      const xOffset = parseInt(document.getElementById("xOffset").value);
      const yOffset = parseInt(document.getElementById("yOffset").value);
      const idealX = startingX + core.col * horizontalSpacing;
      const idealY = startingY + core.row * verticalSpacing;

      vctx.save();
      vctx.beginPath();
      vctx.arc(idealX, idealY, userRadius, 0, Math.PI * 2, true);
      vctx.closePath();

      // Use the isImaginary flag to determine the stroke style
      vctx.strokeStyle = core.isImaginary ? "red" : "green";
      vctx.lineWidth = 2; // Adjust line width as needed
      vctx.stroke();

      vctx.clip();

      const sourceX = core.x + xOffset - userRadius;
      const sourceY = core.y + yOffset - userRadius;

      vctx.drawImage(
        img,
        sourceX,
        sourceY,
        userRadius * 2,
        userRadius * 2,
        idealX - userRadius,
        idealY - userRadius,
        userRadius * 2,
        userRadius * 2
      );

      vctx.restore();

      vctx.fillStyle = "black"; // Text color
      vctx.font = "12px Arial"; // Text font and size
      vctx.fillText(
        `(${core.row},${core.col})`,
        idealX - userRadius / 2,
        idealY - userRadius / 2
      );
    });
  };

  img.onerror = () => {
    console.error("Image failed to load.");
  };
}
function updateVirtualGridSpacing(
    horizontalSpacing,
    verticalSpacing,
    startingX,
    startingY
  ) {
    const virtualGridCanvas = document.getElementById("virtualGridCanvas");
    const vctx = virtualGridCanvas.getContext("2d");
    // Use the loaded image if available, otherwise use default or file input image
    const imageSrc = window.loadedImg
      ? window.loadedImg.src
      : document.getElementById("imageInput").files.length > 0
      ? URL.createObjectURL(document.getElementById("imageInput").files[0])
      : "path/to/default/image.jpg";
  
    // Clear the existing grid
    vctx.clearRect(0, 0, virtualGridCanvas.width, virtualGridCanvas.height);
  
    // Redraw the grid with new spacings
    createVirtualGrid(
      imageSrc,
      window.sortedCoresData,
      horizontalSpacing,
      verticalSpacing,
      startingX,
      startingY
    );
  }
  
// Function to redraw the cores on the canvas
function redrawCores() {
    const imageFile = document.getElementById("imageInput").files[0];
    if ((imageFile || window.loadedImg) && window.cores) {
      if (window.loadedImg) {
        drawCoresOnCanvas(window.loadedImg.src, window.cores);
      } else {
        drawCoresOnCanvas(URL.createObjectURL(imageFile), window.cores);
      }
    } else {
      alert("Please load an image and JSON file first.");
    }
  }
  

  export{
    drawCoresOnCanvas,
    applyAndVisualize,
    createVirtualGrid,
    updateVirtualGridSpacing,
    redrawCores
  }