import os
import json
import numpy as np
from skimage.draw import disk
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from tensorflow.image import resize

def create_mask_from_json(json_data, shape):
    mask = np.zeros(shape, dtype=np.float32)
    for item in json_data:
        rr, cc = disk((item['y'], item['x']), item['radius'], shape=shape)
        mask[rr, cc] = 1.0
    return mask

def resize_labels(labels, original_size, new_size):
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

def load_images_and_labels(image_dir, label_dir, new_size):
    original_size = (1024, 1024)  # Original size of the images and labels
    image_files = [os.path.join(image_dir, file) for file in sorted(os.listdir(image_dir)) if file.endswith('.png')]
    label_files = [os.path.join(label_dir, file) for file in sorted(os.listdir(label_dir)) if file.endswith('.json')]

    images = []
    masks = []

    for image_file, label_file in zip(image_files, label_files):
        # Load and resize image
        image = img_to_array(load_img(image_file, color_mode='rgb', target_size=new_size))
        images.append(image / 255.0)  # Normalizing to [0, 1]

        # Load and resize corresponding label
        with open(label_file, 'r') as file:
            json_data = json.load(file)
        resized_json_data = resize_labels(json_data, original_size, new_size)
        mask = create_mask_from_json(resized_json_data, shape=new_size)
        masks.append(mask)

    return np.array(images), np.array(masks).reshape(-1, *new_size, 1)

# Usage
image_dir = './augmented_images'
label_dir = './augmented_labels'
new_size = (512, 512)  # Example new size
images, masks = load_images_and_labels(image_dir, label_dir, new_size)

def conv_block(input_tensor, num_filters, kernel_size=3, do_batch_norm=True):
    # A conv block consists of two convolutions, each followed by a batch normalization and a relu activation.
    x = Conv2D(num_filters, kernel_size, padding='same', kernel_initializer='he_normal')(input_tensor)
    if do_batch_norm:
        x = BatchNormalization()(x)
    x = Activation('relu')(x)
    
    x = Conv2D(num_filters, kernel_size, padding='same', kernel_initializer='he_normal')(x)
    if do_batch_norm:
        x = BatchNormalization()(x)
    x = Activation('relu')(x)
    return x

def unet(input_size=(512, 512, 3), num_filters=16, depth=2, dropout=0.5, batch_norm=True):
    # INPUT LAYER
    inputs = Input(input_size)
    # CONTRACTING PATH
    conv_blocks = []
    x = inputs
    for i in range(depth):
        x = conv_block(x, num_filters * (2**i), do_batch_norm=batch_norm)
        conv_blocks.append(x)
        x = MaxPooling2D(pool_size=(2, 2))(x)
        if dropout:
            x = Dropout(dropout)(x)

    # BOTTLENECK
    x = conv_block(x, num_filters * (2**(depth)), do_batch_norm=batch_norm)
    
    # EXPANSIVE PATH
    for i in reversed(range(depth)):
        num_filters_exp = num_filters * (2**i)
        x = UpSampling2D(size=(2, 2))(x)
        x = concatenate([x, conv_blocks[i]], axis=3)
        x = conv_block(x, num_filters_exp, do_batch_norm=batch_norm)

    # FINAL CONVOLUTION
    output = Conv2D(1, 1, activation='sigmoid')(x)
    model = Model(inputs=inputs, outputs=output)

    return model

from tensorflow.keras.optimizers.legacy import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, TensorBoard
from tensorflow.keras.models import load_model
from tensorflow.keras import backend as K
import os

from tensorflow.keras.callbacks import LearningRateScheduler
from tensorflow.keras.callbacks import EarlyStopping

# Define a Learning Rate Schedule
def scheduler(epoch, lr):
    if epoch < 50:
        return lr
    elif epoch%10 == 0:
        return lr * tf.math.exp(-0.1)
    else:
        return lr

lr_scheduler = LearningRateScheduler(scheduler)

log_dir = "./tensorboard_logs"

def weighted_binary_crossentropy(zero_weight, one_weight):
    def loss(y_true, y_pred):
        bce = K.binary_crossentropy(y_true, y_pred)
        weight_vector = y_true * one_weight + (1. - y_true) * zero_weight
        weighted_bce = weight_vector * bce

        return K.mean(weighted_bce)
    return loss

def train_unet(model, images, masks, epochs=200, batch_size=32, checkpoint_path='pixel_cores.hdf5'):
    # Define the custom loss function
    custom_loss = weighted_binary_crossentropy(zero_weight=1, one_weight=1)

    # Check if a previous checkpoint exists
    if os.path.exists(checkpoint_path):
        print(f"Loading weights from checkpoint: {checkpoint_path}")
        # Load the model with the custom loss function
        model = load_model(checkpoint_path, custom_objects={'loss': custom_loss})
    else:
        print("No checkpoint found. Starting training from scratch.")

    # Compile the model with the custom loss function
    model.compile(optimizer=Adam(learning_rate=1e-4), loss=custom_loss, metrics=['AUC', 'accuracy', 'Precision', 'Recall'])
    model_checkpoint = ModelCheckpoint(checkpoint_path, monitor='val_loss', verbose=1, save_best_only=True)
    
    # Define the TensorBoard callback
    tensorboard_callback = TensorBoard(log_dir=log_dir, histogram_freq=1)

    # Define the EarlyStopping callback
    early_stopping = EarlyStopping(monitor='val_auc', patience=10, verbose=1, restore_best_weights=True)

    # Fit the model
    history = model.fit(images, masks, batch_size=batch_size, epochs=epochs, verbose=1, validation_split=0.1, 
                        callbacks=[model_checkpoint, tensorboard_callback, lr_scheduler, early_stopping])
    
    return history

from sklearn.model_selection import KFold

# Define the number of folds
num_folds = 10

# Initialize lists to store evaluation metrics for each fold
auc_scores = []
accuracy_scores = []
precision_scores = []
recall_scores = []

# Create an instance of KFold with the desired number of folds
kf = KFold(n_splits=num_folds, shuffle=True, random_state=1234)

# Iterate over each fold
for train_index, val_index in kf.split(images):
    # Split the data into training and validation sets for the current fold
    train_images, val_images = images[train_index], images[val_index]
    train_masks, val_masks = masks[train_index], masks[val_index]

    # Create a new instance of your model
    model = unet()

    # Train the model on the training data for the current fold
    history = train_unet(model, train_images, train_masks)

    # Evaluate the model on the validation data for the current fold
    _, auc, accuracy, precision, recall = history.evaluate(val_images, val_masks)

    # Store the evaluation metrics for the current fold
    auc_scores.append(auc)
    accuracy_scores.append(accuracy)
    precision_scores.append(precision)
    recall_scores.append(recall)

# Calculate the average and standard deviation of the evaluation metrics across all folds
avg_auc = np.mean(auc_scores)
std_auc = np.std(auc_scores)
avg_accuracy = np.mean(accuracy_scores)
std_accuracy = np.std(accuracy_scores)
avg_precision = np.mean(precision_scores)
std_precision = np.std(precision_scores)
avg_recall = np.mean(recall_scores)
std_recall = np.std(recall_scores)

# Print the average and standard deviation of the evaluation metrics
print(f"Average AUC: {avg_auc:.4f} +/- {std_auc:.4f}")
print(f"Average Accuracy: {avg_accuracy:.4f} +/- {std_accuracy:.4f}")
print(f"Average Precision: {avg_precision:.4f} +/- {std_precision:.4f}")
print(f"Average Recall: {avg_recall:.4f} +/- {std_recall:.4f}")
