import tensorflow as tf
import numpy as np
import json
import os
from tensorflow.keras.preprocessing.image import load_img, img_to_array

# Function to resize labels
def resize_labels(labels, original_size, new_size):
    # Adjust the label coordinates for the new image size
    scale_x = new_size[1] / original_size[1]
    scale_y = new_size[0] / original_size[0]
    resized_labels = []
    for label in labels:
        resized_label = {
            'x': label['x'] * scale_x,
            'y': label['y'] * scale_y,
            'radius': label['radius'] * scale_x  # Assuming uniform scaling in x and y
        }
        resized_labels.append(resized_label)
    return resized_labels


# Function to convert labels to EfficientDet format
def convert_to_efficientdet_format(labels, image_shape):
    efficientdet_labels = []
    for label in labels:
        # Calculate the coordinates of the upper left and lower right corners
        xmin = (label['x'] - label['radius']) / image_shape[1]
        ymin = (label['y'] - label['radius']) / image_shape[0]
        xmax = (label['x'] + label['radius']) / image_shape[1]
        ymax = (label['y'] + label['radius']) / image_shape[0]
        # EfficientDet format [ymin, xmin, ymax, xmax]
        efficientdet_labels.append([
            max(0, ymin), max(0, xmin), min(1, ymax), min(1, xmax)
        ])
    return efficientdet_labels


# Function to load images and labels
def load_images_and_labels(image_dir, label_dir, original_size=(1024, 1024), new_size=(512, 512)):
    image_files = [os.path.join(image_dir, file) for file in sorted(os.listdir(image_dir)) if file.endswith('.png')]
    label_files = [os.path.join(label_dir, file) for file in sorted(os.listdir(label_dir)) if file.endswith('.json')]
    
    images = []
    all_boxes = []

    for image_file, label_file in zip(image_files, label_files):
        # Load and resize image
        image = load_img(image_file, color_mode='rgb', target_size=new_size)
        # Convert the image to an array and scale the pixel values to [-1, 1]
        image = (img_to_array(image) / 127.5) - 1
        images.append(image)

        # Load labels and adjust for new image size
        with open(label_file, 'r') as file:
            json_data = json.load(file)
        resized_json_data = resize_labels(json_data, original_size=original_size, new_size=new_size)
        boxes = convert_to_efficientdet_format(resized_json_data, new_size)
        all_boxes.append(boxes)
    
    return np.array(images), all_boxes


# Function to pad labels to a fixed size
def pad_labels(labels, max_boxes=250, pad_value=0):
    padded_labels = []
    for label in labels:
        padded_label = np.zeros((max_boxes, 4), dtype=np.float32) + pad_value
        num_boxes = min(len(label), max_boxes)
        padded_label[:num_boxes] = label[:num_boxes]
        padded_labels.append(padded_label)
    return np.array(padded_labels)

# Function to prepare the dataset
def prepare_dataset(images, boxes, batch_size, num_boxes=250):
    images = tf.constant(images, dtype=tf.float32)
    boxes = pad_labels(boxes, max_boxes=num_boxes)
    boxes = tf.constant(boxes, dtype=tf.float32)

    dataset = tf.data.Dataset.from_tensor_slices((images, boxes))
    dataset = dataset.shuffle(len(images)).batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return dataset

batch_size = 2
image_dir = './TMA_WSI_Padded_PNGs'
label_dir = './TMA_WSI_Labels_updated'
images, boxes = load_images_and_labels(image_dir, label_dir)
# Map this preprocessing function to your dataset


# Assuming we have only one class for object detection and 100 boxes per image
num_boxes = 250  # Maximum number of boxes per image, adjust as needed

dataset = prepare_dataset(images, boxes, batch_size, num_boxes=num_boxes)

# Simplest model architecture

from tensorflow.keras import layers, models

def create_custom_model(input_shape, num_boxes):
    inputs = layers.Input(shape=input_shape)

    # Simplified model architecture
    x = layers.Conv2D(32, kernel_size=(3, 3), activation='relu', padding='same')(inputs)
    x = layers.MaxPooling2D(pool_size=(2, 2))(x)
    x = layers.Conv2D(64, kernel_size=(3, 3), activation='relu', padding='same')(x)
    x = layers.MaxPooling2D(pool_size=(2, 2))(x)
    x = layers.Flatten()(x)
    x = layers.Dense(128, activation='relu')(x)

    # Output layer for bounding box predictions
    boxes_output_flat = layers.Dense(num_boxes * 4, activation='sigmoid', name='boxes_output')(x)
    boxes_output = layers.Reshape((num_boxes, 4))(boxes_output_flat)

    model = models.Model(inputs=inputs, outputs=boxes_output)
    
    return model

# Example usage
input_shape = (512, 512, 3)
num_boxes = 250

model = create_custom_model(input_shape, num_boxes)
from tensorflow.keras.callbacks import TensorBoard, ModelCheckpoint, LearningRateScheduler
import datetime
import os
from tensorflow.keras.callbacks import EarlyStopping


# Define the Smooth L1 Loss Function
def smooth_l1_loss(sigma=3.0):
    sigma_squared = sigma ** 2
    
    def smooth_l1_loss_fixed(y_true, y_pred):
        regression_diff = y_true - y_pred
        regression_diff = tf.abs(regression_diff)
        regression_loss = tf.where(
            tf.less(regression_diff, 1.0 / sigma_squared),
            0.5 * sigma_squared * tf.pow(regression_diff, 2),
            regression_diff - 0.5 / sigma_squared
        )
        regression_loss = tf.reduce_sum(regression_loss, axis=-1)
        return tf.reduce_mean(regression_loss)
    
    return smooth_l1_loss_fixed

    
# Compile the Model with the Custom Loss
model.compile(optimizer='adam',
              loss=smooth_l1_loss(),  # Only use smooth L1 loss for bounding box predictions
              metrics=['mean_squared_error'])  # Added a metric for bounding box prediction quality

# Set up TensorBoard logging
log_dir = "logs/fit/" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
tensorboard_callback = TensorBoard(log_dir=log_dir, histogram_freq=1)

# Set up checkpoints to save the model
checkpoint_dir = "checkpoints/"
if not os.path.exists(checkpoint_dir):
    os.makedirs(checkpoint_dir)
checkpoint_path = checkpoint_dir + "cp-{epoch:04d}.ckpt"
checkpoint_callback = ModelCheckpoint(
    filepath=checkpoint_path,
    verbose=1,
    save_weights_only=True,
    save_best_only=False  # Set to True to save only the best model based on validation loss
)

# Define a Learning Rate Schedule
def scheduler(epoch, lr):
    if epoch < 25:
        return lr
    elif epoch%10 == 0:
        return lr * tf.math.exp(-0.1)
    else:
        return lr

learning_rate_callback = LearningRateScheduler(scheduler)

early_stopping_callback = EarlyStopping(monitor='val_loss', patience=50, mode='min')

# Initialize a list to store the results
results = []


# Split the dataset into 10 folds
kf = KFold(n_splits=10, shuffle=True, random_state=42)

fold_no = 1
for train_index, val_index in kf.split(images):
    train_images, val_images = images[train_index], images[val_index]
    train_boxes, val_boxes = [boxes[i] for i in train_index], [boxes[i] for i in val_index]

    # Prepare the training and validation datasets
    train_dataset = prepare_dataset(train_images, train_boxes, batch_size, num_boxes=num_boxes)
    val_dataset = prepare_dataset(val_images, val_boxes, batch_size, num_boxes=num_boxes)

    # Create a new instance of the model (to reset weights)
    model = create_custom_model(num_boxes)

    # Compile the model
    model.compile(optimizer='adam', loss='mse', metrics=['mean_squared_error'])

    print(f'Training for fold {fold_no} ...')

    # Fit the model
    history = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=350,
        callbacks=[
            tensorboard_callback, 
            checkpoint_callback, 
            learning_rate_callback, 
            early_stopping_callback  # Add the early stopping callback here
        ]
    )


    # Save the model
    model.save(f'model_fold_{fold_no}.h5')

    # Log the results
    val_loss, val_mse = model.evaluate(val_dataset)
    results.append({'fold': fold_no, 'val_loss': val_loss, 'val_mse': val_mse})

    # Increase the fold number
    fold_no += 1