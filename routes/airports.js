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
    const query = req.query.q;

    if (!query) {
      // no query, so return the last 5 airports used by the user
      const { data, error } = await supabase.rpc(
        "get_recent_photo_airports_by_user",
        {
          p_user_id: req.user.id,
        },
      );

      console.log("Recent airports data:", data, "error:", error);

      if (error) {
        throw error;
      } else if (data.length == 0) {
        // user has no recent airports, return 5 airports
        const { data: airports, error: airportsError } = await supabase
          .from("Airport")
          .select("icao_code, name")
          .order("name", { ascending: true })
          .limit(5);

        if (airportsError) throw airportsError;
        return res.json(airports);
      } else {
        return res.json(data);
      }
    }

    // user passed in a query for airport search
    if (query.startsWith("K") && query.length >= 4) {
      // likely a US airport, search by ICAO code
      console.log("Searching by ICAO code", query);
      const { data, error } = await supabase
        .from("Airport")
        .select("icao_code, name")
        .ilike("icao_code", `${query}%`)
        .order("name", { ascending: true })
        .limit(5);
      if (error) throw error;
      return res.json(data);
    } else {
      // search by name
      const { data, error } = await supabase
        .from("Airport")
        .select("icao_code, name")
        .ilike("name", `%${query}%`)
        .order("name", { ascending: true })
        .limit(5);
      if (error) throw error;
      return res.json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
