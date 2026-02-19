const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

// Middleware: Admins only
const requireAdmin = (req, res, next) => {
  if (req.user.type !== "admin") {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
};

router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  const { icao_type, manufacturer, type, variant } = req.body;

  if (!icao_type || !manufacturer || !type) {
    return res
      .status(400)
      .json({ error: "ICAO Type, Manufacturer, and Type are required" });
  }

  try {
    const { data, error } = await supabase
      .from("AircraftType")
      .insert([
        {
          icao_type: icao_type.toUpperCase(),
          manufacturer,
          type,
          variant,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Aircraft Type with this ICAO Type already exists." });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("AircraftType")
      .select("*")
      .order("manufacturer", { ascending: true }) // First priority
      .order("type", { ascending: true }) // Second priority
      .order("variant", { ascending: true }); // Third priority

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
