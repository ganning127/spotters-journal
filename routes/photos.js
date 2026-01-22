// routes/photos.js
const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

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
  const {
    registration,
    airport_code,
    image_url,
    taken_at,
    shutter_speed,
    iso,
    aperture,
    camera_model,
    focal_length,
    // New optional fields for new aircraft
    aircraft_type_id,
    manufactured_date,
  } = req.body;

  try {
    // 1. Upsert the Aircraft
    // If 'aircraft_type_id' is provided, we update/insert the full record.
    // If not, we just ensure the registration exists (skeleton entry).
    const aircraftData = { registration };

    if (aircraft_type_id) aircraftData.type_id = aircraft_type_id;
    if (manufactured_date) aircraftData.manufactured_date = manufactured_date;
    console.log("Upserting aircraft data:", aircraftData);
    const { error: aircraftError } = await supabase
      .from("SpecificAircraft")
      .upsert([aircraftData], { onConflict: "registration" });

    if (aircraftError) {
      throw new Error(
        `Failed to initialize aircraft: ${aircraftError.message}`,
      );
    }

    // 2. Insert Photo (Standard flow)
    const { data, error } = await supabase
      .from("Photo")
      .insert([
        {
          user_id: req.user.id,
          registration,
          airport_code,
          image_url,
          taken_at,
          shutter_speed,
          iso,
          aperture,
          camera_model,
          focal_length,
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
