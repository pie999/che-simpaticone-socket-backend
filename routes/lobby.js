const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const User = require("../models/user");

router.get(
  "/lobby",
  asyncHandler(async (req, res) => {
    const allUsers = await User.find().exec();
    res.json(allUsers);
  })
);

router.post(
  "/lobby",
  asyncHandler(async (req, res) => {
    const user = new User({
      name: req.body.name,
    });
    await user.save();
    res.json(user);
  })
);

router.post("/user-leaving", async (req, res) => {
  await User.deleteOne({ id: req.body.userId });
  res.status(204).end();
});

module.exports = router;
