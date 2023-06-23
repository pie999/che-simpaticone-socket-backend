const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  name: { type: String, required: true },
});

module.exports = mongoose.model("User", MessageSchema);
