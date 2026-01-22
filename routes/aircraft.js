// routes/aircraft.js
const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

router.get("/search", authenticateToken, async (req, res) => {
  const query = req.query.q;

  if (!query || query.length < 2) {
    return res.json([]);
  }

  try {
    const { data, error } = await supabase
      .from("SpecificAircraft")
      .select("registration, created_at, type_id")
      .ilike("registration", `${query}%`) // Starts with query, case-insensitive
      .limit(10); // Limit results to keep it fast

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
