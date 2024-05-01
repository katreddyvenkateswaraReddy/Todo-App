const { time } = require("console");
const mongoose = require("mongoose");
const { todo } = require("node:test");
const Schema = mongoose.Schema;

const todoSchema = new Schema(
  {
    todo: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("todo", todoSchema);
