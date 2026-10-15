const express = require("express");
const router = express.Router();
const Contact = require("../models/Contact");

router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (
      !name?.trim() ||
      !email?.trim() ||
      !subject?.trim() ||
      !message?.trim()
    ) {
      return res.status(400).json({
        message: "Please complete all required fields.",
      });
    }

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!validEmail) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({
        message: "Message must contain at least 10 characters.",
      });
    }

    const contact = await Contact.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Your message has been received successfully.",
      contactId: contact._id,
    });
  } catch (error) {
    console.error("Contact form error:", error);

    return res.status(500).json({
      message: "Unable to submit your message. Please try again later.",
    });
  }
});

module.exports = router;