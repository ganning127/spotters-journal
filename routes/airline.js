// routes/aircraft.js
const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("Airline")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
