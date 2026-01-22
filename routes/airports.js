const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.type !== "admin") {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
};

// POST /api/airports (Admins Only)
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  const { icao_code, name, latitude, longitude } = req.body;

  if (!icao_code || !name) {
    return res.status(400).json({ error: "ICAO code and Name are required" });
  }

  try {
    const { data, error } = await supabase
      .from("Airport")
      .insert([
        {
          icao_code: icao_code.toUpperCase(),
          name,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    // Check for duplicate key error (Postgres code 23505)
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Airport with this ICAO code already exists." });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("Airport")
      .select("icao_code, name")
      .order("name", { ascending: true }); // Alphabetical order is usually best for dropdowns

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
