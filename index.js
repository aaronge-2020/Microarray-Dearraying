// import * as cocoSsd from "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/+esm";
// import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/+esm";

const model = await cocoSsd.load();

const newModel = tf.model({
    inputs: model.inputs,
    outputs: model.layers[model.layers.length - 2].output
  });

  model.compile({
    optimizer: tf.train.adam(),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });