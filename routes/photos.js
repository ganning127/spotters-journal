// routes/photos.js
const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

router.get("/airline-counts", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("get_airline_counts_by_user", {
      p_user_id: req.user.id,
      p_limit: 10,
    });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/airplane-counts", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("get_airplane_counts_by_user", {
      p_user_id: req.user.id,
      p_limit: 8,
    });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/photo-counts", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc(
      "get_user_photo_counts_by_user_and_by_year",
      {
        p_user_id: req.user.id,
        p_num_years: 5,
      },
    );

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/my-photos", authenticateToken, async (req, res) => {
  try {
    // 1. Parse Query Params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9; // 9 photos per page
    const search = req.query.search || "";

    // Calculate Supabase Range (0-based index)
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 2. Build Query
    let query = supabase
      .from("Photo")
      .select(
        `
        *,
        Airport ( name, icao_code ),
        SpecificAircraft (
          registration,
          AircraftType ( manufacturer, type, variant )
        )
      `,
        { count: "exact" },
      ) // Request total count for pagination
      .eq("user_id", req.user.id)
      .order("taken_at", { ascending: false })
      .range(from, to);

    // 3. Apply Search (if provided)
    if (search) {
      // Filter by registration column on the Photo table
      query = query.ilike("registration", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // 4. Return Data + Pagination Meta
    res.json({
      data,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  let {
    registration,
    airport_code,
    image_url,
    taken_at,
    shutter_speed,
    iso,
    aperture,
    camera_model,
    focal_length,

    // SpecificAircraft fields
    aircraft_type_id, // optional
    manufactured_date, // optional
    airline_code, // optional

    // Airport fields (if airport_code is 'other')
    airport_icao_code, // all below are optional
    airport_name,
    airport_latitude,
    airport_longitude,
  } = req.body;

  try {
    // in case user is adding a new airport
    if (airport_code === "other") {
      if (
        !airport_icao_code ||
        !airport_name ||
        !airport_latitude ||
        !airport_longitude
      ) {
        return res.status(400).json({
          error: "All airport fields are required for 'other' airport.",
        });
      }

      const { error: airportError } = await supabase.from("Airport").insert([
        {
          icao_code: airport_icao_code.toUpperCase(),
          name: airport_name,
          latitude: parseFloat(airport_latitude),
          longitude: parseFloat(airport_longitude),
        },
      ]);

      if (airportError) {
        return res
          .status(500)
          .json({ error: `Failed to insert airport: ${airportError.message}` });
      }

      airport_code = airport_icao_code.toUpperCase(); // set airport_code to use for the photo
    }

    // in case user is adding a new SpecificAircraft
    if (aircraft_type_id) {
      // trying to create a new SpecificAircraft
      if (!manufactured_date) {
        return res.status(400).json({
          error:
            "Manufactured date is required when providing aircraft_type_id.",
        });
      }

      const { error: typeError } = await supabase
        .from("SpecificAircraft")
        .insert([
          {
            registration,
            type_id: aircraft_type_id,
            manufactured_date,
            airline: airline_code,
          },
        ]);

      if (typeError) {
        return res.status(500).json({
          error: `Failed to insert specific aircraft: ${typeError.message}`,
        });
      }
    }

    const { data, error } = await supabase
      .from("Photo")
      .insert([
        {
          user_id: req.user.id,
          registration,
          airport_code,
          image_url,
          taken_at: taken_at || null,
          shutter_speed: shutter_speed || null,
          iso: iso || null,
          aperture: aperture || null,
          camera_model: camera_model || null,
          focal_length: focal_length || null,
        },
      ])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("Photo")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id); // Critical security check

    if (error) throw error;
    res.json({ message: "Photo deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
