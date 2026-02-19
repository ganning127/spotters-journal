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
      .from("RegistrationHistory")
      .select(
        `
        uuid_rh,
        airline,
        Airline ( name ),
        SpecificAircraft!inner (
          icao_type,
          AircraftType!inner (
            manufacturer,
            type,
            variant
          )
        ),
        Photo!left (         
          image_url, 
          taken_at,
          airport_code,
          user_id
        )
      `,
      )
      .eq("registration", query.toUpperCase())
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (data.length === 0) {
      res.json({
        is_new_aircraft: true,
      });
      return;
    } else {
      const results = data.map((resultObj) => {
        const flattenedSpecificAircraft = {
          icao_type: resultObj.SpecificAircraft.icao_type,
          manufacturer: resultObj.SpecificAircraft.AircraftType.manufacturer,
          type: resultObj.SpecificAircraft.AircraftType.type,
          variant: resultObj.SpecificAircraft.AircraftType.variant,
        };

        // Filter Photos to only show the user's photos
        const userPhotos = resultObj.Photo.filter(
          (photo) => photo.user_id === req.user.id,
        );

        return {
          ...resultObj,
          type_id: resultObj.SpecificAircraft.icao_type,
          airline_name: resultObj.Airline?.name,
          SpecificAircraft: flattenedSpecificAircraft,
          Photo: userPhotos, // Override with filtered photos
        };
      });

      res.json({
        is_new_aircraft: false,
        aircraft: results,
      });
      return;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/new-registration", authenticateToken, async (req, res) => {
  const query = req.query.q;

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
