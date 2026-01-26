// routes/aircraft.js
const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY;
const AIRLABS_BASE_URL = process.env.AIRLABS_BASE_URL;

router.get("/search", authenticateToken, async (req, res) => {
  const query = req.query.q;

  if (!query || query.length < 2) {
    return res.json([]);
  }

  try {
    const { data, error } = await supabase
      .from("SpecificAircraft")
      .select(
        `
        type_id,
        Photo!left (         
          image_url, 
          taken_at,
          airport_code
        )
      `,
      )
      .eq("registration", query.toUpperCase())
      .eq("Photo.user_id", req.user.id)
      .limit(1);

    if (error) throw error;

    if (data.length === 0) {
      res.json({
        is_new_aircraft: true,
      });
      return;
    } else {
      res.json({
        is_new_aircraft: false,
        aircraft: data[0],
      });
    }

    res.json({
      data: forUser,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/new-registration", authenticateToken, async (req, res) => {
  const query = req.query.q;

  /*
  returns:
  {
    aircraft_type_id: string (icao code),
    airline_code: string (icao code),
  }
    */

  if (!query || query.length === 0) {
    return res.json([]);
  }

  try {
    const result = await fetch(
      `${AIRLABS_BASE_URL}/fleets?reg_number=${query.toUpperCase()}&api_key=${AIRLABS_API_KEY}`,
    );
    const data = await result.json();
    const response = data.response;

    if (!response || response.length === 0) {
      return res.json({
        found: false,
      });
    } else {
      return res.json({
        found: true,
        aircraft_type_id: response[0].icao,
        airline_code: response[0].airline_icao,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
