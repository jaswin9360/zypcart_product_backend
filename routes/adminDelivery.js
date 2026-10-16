import express from "express"
import DeliveryPartner from "../models/DeliveryPartner.js";


const router = express.Router();

// Apply your existing requireLogin and requireAdmin middleware
// when mounting this router in server.js.

// GET /api/admin/delivery-partners
router.get("/", async (req, res) => {
  try {
    const partners = await DeliveryPartner.find()
      .select("-documents")
      .sort({ createdAt: -1 });

    res.json({ partners });
  } catch {
    res.status(500).json({ message: "Could not load applications." });
  }
});

// PATCH /api/admin/delivery-partners/:id/approval
router.patch("/:id/approval", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be approved or rejected.",
      });
    }

    const partner = await DeliveryPartner.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    res.json({ message: `Application ${status}.`, partner });
  } catch {
    res.status(500).json({ message: "Could not update application." });
  }
});

export default router;