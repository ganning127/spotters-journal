// routes/photos.js
const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

// 1. Shared Constants & Helpers
const BASE_SELECT = `
  *,
  Airport ( name, icao_code ),
  SpecificAircraft!inner (
    AircraftType!inner ( id, manufacturer, type, variant )
  )
`;

/**
 * Applies the standard filters used by both routes.
 * @param {SupabaseClient} supabaseQuery - The query builder instance
 * @param {Object} params - Filter parameters
 * @param {string} params.userId - The authenticated user's ID
 * @param {string} params.search - Search string for registration
 * @param {Array} params.filterArray - Array of aircraft types/ids to filter
 * @param {string} params.filterColumn - The specific DB column to target for the array filter
 */
const applyPhotoFilters = (
  query,
  { userId, search, filterArray, filterColumn },
) => {
  // Always filter by User
  query = query.eq("user_id", userId);

  // Search Filter (Registration)
  if (search) {
    query = query.ilike("registration", `%${search}%`);
  }

  // Aircraft Type Filter
  // We use filterColumn to support the different targeting strategies of your two routes
  if (filterArray && filterArray.length > 0) {
    query = query.in(filterColumn, filterArray);
  }

  return query;
};

// --- ROUTES ---

router.get("/my-photos", authenticateToken, async (req, res) => {
  try {
    // 1. Parse Inputs
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const search = req.query.search || "";
    // Route 1 filters using the direct ID column
    const aircraftTypeFilter = req.query.aircraftTypeFilter
      ? JSON.parse(req.query.aircraftTypeFilter)
      : [];
    const filterColumn = "SpecificAircraft.type_id";

    // 2. Build Query
    let query = supabase
      .from("Photo")
      .select(BASE_SELECT, { count: "exact" })
      .order("taken_at", { ascending: false });

    // 3. Apply Filters
    query = applyPhotoFilters(query, {
      userId: req.user.id,
      search,
      filterArray: aircraftTypeFilter,
      filterColumn,
    });

    // 4. Apply Pagination Range
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    // 5. Return Response
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

router.get("/my-photos/random", authenticateToken, async (req, res) => {
  try {
    // 1. Parse Inputs
    const limit = 10; // Fixed internal limit as per original code
    const search = req.query.search || "";
    // Route 2 filters using the nested relationship string
    const aircraftTypeFilter = req.query.aircraftTypeFilter
      ? JSON.parse(req.query.aircraftTypeFilter)
      : [];
    const filterColumn = "SpecificAircraft.AircraftType.type";

    const filterParams = {
      userId: req.user.id,
      search,
      filterArray: aircraftTypeFilter,
      filterColumn,
    };

    // 2. Get Count (Head Query)
    let countQuery = supabase
      .from("Photo")
      .select("SpecificAircraft!inner(AircraftType!inner(type))", {
        count: "exact",
        head: true,
      });

    countQuery = applyPhotoFilters(countQuery, filterParams);

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    if (count === 0) {
      return res.json({ data: [], meta: { total: 0, limit } });
    }

    // 3. Calculate Random Offset
    let randomOffset = 0;
    if (count > limit) {
      randomOffset = Math.floor(Math.random() * (count - limit));
    }

    // 4. Fetch Data (with Offset)
    let dataQuery = supabase.from("Photo").select(BASE_SELECT);

    dataQuery = applyPhotoFilters(dataQuery, filterParams);

    const { data, error: dataError } = await dataQuery.range(
      randomOffset,
      randomOffset + limit - 1,
    );

    if (dataError) throw dataError;

    // 5. Return Response
    res.json({
      data,
      meta: {
        total: count,
        limit,
        offset: randomOffset,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/airline-counts", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("get_airline_counts_by_user", {
      p_user_id: req.user.id,
      p_limit: req.query.limit ? parseInt(req.query.limit) : 10,
    });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/airport-counts", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("get_airport_counts_by_user", {
      p_user_id: req.user.id,
      p_limit: req.query.limit ? parseInt(req.query.limit) : 10,
    });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/airplane-counts", authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 8;
    const { data, error } = await supabase.rpc("get_airplane_counts_by_user", {
      p_user_id: req.user.id,
      p_limit: limit,
    });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/manufacturer-counts", authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 8;
    const { data, error } = await supabase.rpc(
      "get_manufacturer_counts_by_user",
      {
        p_user_id: req.user.id,
        p_limit: limit,
      },
    );

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/most-seen-aircraft", authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 8;
    const { data, error } = await supabase.rpc(
      "get_most_seen_aircraft_by_user",
      {
        p_user_id: req.user.id,
        p_limit: limit,
      },
    );

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
        p_num_years: req.query.num_years ? parseInt(req.query.num_years) : 5,
      },
    );

    if (error) throw error;

    res.json(data);
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
      const { error: typeError } = await supabase
        .from("SpecificAircraft")
        .insert([
          {
            registration,
            type_id: aircraft_type_id,
            manufactured_date: manufactured_date || null,
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
