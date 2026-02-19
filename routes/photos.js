// routes/photos.js
const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

// 1. Shared Constants & Helpers
const BASE_SELECT = `
  *,
  Airport ( name, icao_code ),
  RegistrationHistory!inner (
    registration,
    airline,
    is_current,
    SpecificAircraft!inner (
      manufactured_date,
      AircraftType!inner ( icao_type, manufacturer, type, variant )
    )
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
    // Filter on the joined RegistrationHistory table
    query = query.ilike("RegistrationHistory.registration", `%${search}%`);
  }

  // Aircraft Type Filter
  // We use filterColumn to support the different targeting strategies of your two routes
  if (filterArray && filterArray.length > 0) {
    // Note: filterColumn must now act on the nested relationship
    // e.g. "RegistrationHistory.SpecificAircraft.icao_type"
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
    const filterColumn = "RegistrationHistory.SpecificAircraft.icao_type";

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
    const limit = 5; // Fixed internal limit as per original code
    const search = req.query.search || "";
    // Route 2 filters using the nested relationship string
    const aircraftTypeFilter = req.query.aircraftTypeFilter
      ? JSON.parse(req.query.aircraftTypeFilter)
      : [];

    const filterColumn = "RegistrationHistory.SpecificAircraft.icao_type";

    const filterParams = {
      userId: req.user.id,
      search,
      filterArray: aircraftTypeFilter,
      filterColumn,
    };

    let countQuery = supabase
      .from("Photo")
      .select("RegistrationHistory!inner(SpecificAircraft!inner(icao_type))", {
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

    let uuid_rh = null;

    // in case user is adding a new SpecificAircraft (or new registration context)
    if (aircraft_type_id) {
      // 1. Create SpecificAircraft
      const { data: saData, error: saError } = await supabase
        .from("SpecificAircraft")
        .insert([
          {
            icao_type: aircraft_type_id,
            manufactured_date: manufactured_date || null,
          },
        ])
        .select()
        .single();

      if (saError) {
        return res.status(500).json({
          error: `Failed to insert specific aircraft: ${saError.message}`,
        });
      }

      // 2. Create RegistrationHistory
      // Note: We assume this new entry is 'current'
      const { data: rhData, error: rhError } = await supabase
        .from("RegistrationHistory")
        .insert([
          {
            uuid_sa: saData.uuid,
            registration: registration.toUpperCase(),
            airline: airline_code,
            is_current: true,
          },
        ])
        .select()
        .single();

      if (rhError) {
        return res.status(500).json({
          error: `Failed to insert registration history: ${rhError.message}`,
        });
      }
      uuid_rh = rhData.uuid_rh;
    } else {
      // Existing aircraft flow: Find uuid_rh by registration
      // We prefer the 'current' one if multiple exist, or just the first one.
      const { data: rhData, error: rhLookupError } = await supabase
        .from("RegistrationHistory")
        .select("uuid_rh")
        .eq("registration", registration.toUpperCase())
        .limit(1);

      if (rhLookupError) {
        return res.status(500).json({ error: rhLookupError.message });
      }

      if (!rhData || rhData.length === 0) {
        return res
          .status(404)
          .json({ error: "Registration not found. Please provide aircraft details." });
      }
      uuid_rh = rhData[0].uuid_rh;
    }

    const { data, error } = await supabase
      .from("Photo")
      .insert([
        {
          user_id: req.user.id,
          uuid_rh: uuid_rh,
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
