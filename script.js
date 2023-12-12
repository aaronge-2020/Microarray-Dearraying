document.addEventListener('DOMContentLoaded', function() {
    const uploadButton = document.getElementById('upload');
    const originalImageContainer = document.getElementById('originalImage');
    const processedImageContainer = document.getElementById('processedImage');
  
    uploadButton.addEventListener('click', function() {
      let fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.onchange = e => {
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.onload = function(e) {
          // Display the original image
          originalImageContainer.src = e.target.result;
  
          let img = new Image();
          img.onload = function() {
            // Create a canvas to manipulate the image
            let canvas = document.createElement('canvas');
            let ctx = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 512;
  
            // Draw the image onto the canvas and resize it
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
            // Get the image data
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imageData.data;
  
            // Normalize pixel values to between 0 and 1
            for (let i = 0; i < data.length; i += 4) {
              data[i]     = data[i] / 255;     // Red
              data[i + 1] = data[i + 1] / 255; // Green
              data[i + 2] = data[i + 2] / 255; // Blue
              // Alpha channel doesn't need to be normalized (remains 255 for full opacity)
            }
  
            // Update the canvas with the new image data
            ctx.putImageData(imageData, 0, 0);
  
            // Set the source of the processed image container to the canvas data
            processedImageContainer.src = canvas.toDataURL();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };
      fileInput.click(); // Simulate click on file input
    });
  });
  

const modelUrl = './tfjs_model/model.json';

const core_detection_model = loadModel(modelUrl);

