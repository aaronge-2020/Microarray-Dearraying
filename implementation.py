def create_mask_from_json(json_data, shape):
    mask = np.zeros(shape, dtype=np.float32)
    for item in json_data:
        rr, cc = disk((item['y'], item['x']), 0, shape=shape)  # '16' is an arbitrary radius for the core
        mask[rr, cc] = 1.0
    return mask

def load_images_and_labels(image_dir, label_dir):
    image_files = [os.path.join(image_dir, file) for file in sorted(os.listdir(image_dir)) if file.endswith('.png')]
    label_files = [os.path.join(label_dir, file) for file in sorted(os.listdir(label_dir)) if file.endswith('.json')]
    
    images = []
    masks = []

    for image_file, label_file in zip(image_files, label_files):
        # Load image
        image = img_to_array(load_img(image_file, color_mode='rgb'))  # or 'rgb' if your images are colored
        images.append(image / 255.0)  # Normalizing to [0, 1]

        # Load corresponding label
        with open(label_file, 'r') as file:
            json_data = json.load(file)
        mask = create_mask_from_json(json_data, shape=(1024, 1024))
        masks.append(mask)

    return np.array(images), np.array(masks).reshape(-1, 1024, 1024, 1)

# Usage
image_dir = './TMA_WSI_Padded_PNGs'
label_dir = './TMA_WSI_Labels_updated'
images, masks = load_images_and_labels(image_dir, label_dir)

from tensorflow.keras.layers import LeakyReLU

def conv_block(input_tensor, num_filters, kernel_size=3, do_batch_norm=True, leaky_relu_alpha=0.01):
    # A conv block consists of two convolutions, each followed by a batch normalization and a Leaky ReLU activation.
    x = Conv2D(num_filters, kernel_size, padding='same', kernel_initializer='he_normal')(input_tensor)
    if do_batch_norm:
        x = BatchNormalization()(x)
    x = LeakyReLU(alpha=leaky_relu_alpha)(x)
    
    x = Conv2D(num_filters, kernel_size, padding='same', kernel_initializer='he_normal')(x)
    if do_batch_norm:
        x = BatchNormalization()(x)
    x = LeakyReLU(alpha=leaky_relu_alpha)(x)
    return x

def unet(input_size=(1024, 1024, 3), num_filters=32, depth=3, dropout=0.5, batch_norm=True, leaky_relu_alpha=0.01):
    # INPUT LAYER
    inputs = Input(input_size)
    # CONTRACTING PATH
    conv_blocks = []
    x = inputs
    for i in range(depth):
        x = conv_block(x, num_filters * (2**i), do_batch_norm=batch_norm, leaky_relu_alpha=leaky_relu_alpha)
        conv_blocks.append(x)
        x = MaxPooling2D(pool_size=(2, 2))(x)
        if dropout:
            x = Dropout(dropout)(x)

    # BOTTLENECK
    x = conv_block(x, num_filters * (2**(depth)), do_batch_norm=batch_norm, leaky_relu_alpha=leaky_relu_alpha)
    
    # EXPANSIVE PATH
    for i in reversed(range(depth)):
        num_filters_exp = num_filters * (2**i)
        x = UpSampling2D(size=(2, 2))(x)
        x = concatenate([x, conv_blocks[i]], axis=3)
        x = conv_block(x, num_filters_exp, do_batch_norm=batch_norm, leaky_relu_alpha=leaky_relu_alpha)

    # FINAL CONVOLUTION
    output = Conv2D(1, 1, activation='sigmoid')(x)
    model = Model(inputs=inputs, outputs=output)

    return model



from tensorflow.keras.optimizers.legacy import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, TensorBoard
from tensorflow.keras.models import load_model
from tensorflow.keras import backend as K
import os

from tensorflow.keras.optimizers.legacy import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, TensorBoard
from tensorflow.keras.models import load_model
from tensorflow.keras import backend as K
import os

from tensorflow.keras.callbacks import LearningRateScheduler

# Define a learning rate schedule (example: decrease learning rate by half every 10 epochs)
def lr_schedule(epoch, lr):
    if epoch % 5 == 0 and epoch != 0:
        lr = lr / 2
    return lr

# Add this to your callbacks in the training function
lr_scheduler = LearningRateScheduler(lr_schedule, verbose=1)


log_dir = "./tensorboard_logs"


def focal_loss(gamma=2., alpha=.25):
    def focal_loss_fixed(y_true, y_pred):
        pt_1 = tf.where(tf.equal(y_true, 1), y_pred, tf.ones_like(y_pred))
        pt_0 = tf.where(tf.equal(y_true, 0), y_pred, tf.zeros_like(y_pred))

        # Clip the predicted values to prevent log(0) error.
        eps = 1e-12
        pt_1 = tf.clip_by_value(pt_1, eps, 1. - eps)
        pt_0 = tf.clip_by_value(pt_0, eps, 1. - eps)

        return -tf.reduce_sum(alpha * tf.pow(1. - pt_1, gamma) * tf.math.log(pt_1)) \
               -tf.reduce_sum((1 - alpha) * tf.pow(pt_0, gamma) * tf.math.log(1. - pt_0))

    return focal_loss_fixed

# You would then compile your model with this loss, adjusting the weights as needed for your imbalance
def train_unet(model, images, masks, epochs=20, batch_size=3, checkpoint_path='pixel_cores.hdf5'):
    
    # Define the custom loss function
    custom_loss = focal_loss(gamma=2.0, alpha=0.25)

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

    # Fit the model
    history = model.fit(images, masks, batch_size=batch_size, epochs=epochs, verbose=1, validation_split=0.1, callbacks=[model_checkpoint, tensorboard_callback, lr_scheduler])
    
    return history


# Using the functions
history = train_unet(model, images, masks)


# Define the loss functions
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
        # Sum over the last dimension to get the total loss for each bounding box
        regression_loss = tf.reduce_sum(regression_loss, axis=-1)
        # Compute the mean loss over all the bounding boxes
        return tf.reduce_mean(regression_loss)
    
    return smooth_l1_loss_fixed


def focal_loss(gamma=2.0, alpha=0.25):
    def focal_loss_fixed(y_true, y_pred):
        # Add epsilon to prevent log(0)
        epsilon = tf.keras.backend.epsilon()
        y_pred = tf.clip_by_value(y_pred, epsilon, 1. - epsilon)

        cross_entropy = -y_true * tf.math.log(y_pred)
        weights = alpha * tf.pow(1 - y_pred, gamma)
        
        # Reduce the last dimension to get the focal loss for each class
        focal_loss = weights * cross_entropy
        focal_loss = tf.reduce_sum(focal_loss, axis=-1)
        # Compute the mean loss over all the classes
        return tf.reduce_mean(focal_loss)
    
    return focal_loss_fixed


# Compile the model with the custom loss and an optimizer
model.compile(optimizer='adam',
              loss={
                  'boxes_output': smooth_l1_loss(),
                  'class_output': focal_loss()
              },
              metrics={'class_output': 'accuracy'})  # Assuming 'accuracy' is a suitable metric for your classification


# Fit the model on the prepared dataset
# The dataset should output a tuple of (images, {'boxes_output': boxes, 'class_output': class_labels})
history = model.fit(dataset, epochs=10, steps_per_epoch=100)