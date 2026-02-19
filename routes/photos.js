// routes/photos.js
const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");
const multer = require("multer");
const sharp = require("sharp");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

// --- S3 Configuration ---
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
 */
const applyPhotoFilters = (
  query,
  { userId, search, filterArray, filterColumn },
) => {
  query = query.eq("user_id", userId);

  if (search) {
    query = query.ilike("RegistrationHistory.registration", `%${search}%`);
  }

  if (filterArray && filterArray.length > 0) {
    query = query.in(filterColumn, filterArray);
  }

  return query;
};

// --- ROUTES ---

router.get("/my-photos", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const search = req.query.search || "";
    const aircraftTypeFilter = req.query.aircraftTypeFilter
      ? JSON.parse(req.query.aircraftTypeFilter)
      : [];
    const filterColumn = "RegistrationHistory.SpecificAircraft.icao_type";

    let query = supabase
      .from("Photo")
      .select(BASE_SELECT, { count: "exact" })
      .order("taken_at", { ascending: false });

    query = applyPhotoFilters(query, {
      userId: req.user.id,
      search,
      filterArray: aircraftTypeFilter,
      filterColumn,
    });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

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
    const limit = 5;
    const search = req.query.search || "";
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

    let randomOffset = 0;
    if (count > limit) {
      randomOffset = Math.floor(Math.random() * (count - limit));
    }

    let dataQuery = supabase.from("Photo").select(BASE_SELECT);

    dataQuery = applyPhotoFilters(dataQuery, filterParams);

    const { data, error: dataError } = await dataQuery.range(
      randomOffset,
      randomOffset + limit - 1,
    );

    if (dataError) throw dataError;

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

// --- UPDATED POST ROUTE ---
router.post(
  "/",
  authenticateToken,
  upload.single("image"), // Expect a file field named "image"
  async (req, res) => {
    let {
      registration,
      airport_code,
      
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

      // Registration History ID (optional, reuse existing)
      uuid_rh,

      // Airport fields (if airport_code is 'other')
      airport_icao_code,
      airport_name,
      airport_latitude,
      airport_longitude,
    } = req.body;

    // Default nulls if empty strings
    taken_at = taken_at || null;
    shutter_speed = shutter_speed || null;
    iso = iso || null;
    aperture = aperture || null;
    camera_model = camera_model || null;
    focal_length = focal_length || null;
    manufactured_date = manufactured_date || null;

    if (!req.file) {
      return res.status(400).json({ error: "Image file is required." });
    }

    try {
      // 1. Process Image
      // Resize to ensure it's under ~500KB (heuristic: 1920px max width, 80% quality)
      const buffer = await sharp(req.file.buffer)
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true }) 
        .toBuffer();

      // Determine if it's actually under 500KB
      // If not, could resize more aggressively, but 80% quality jpeg at 1920px is typically small enough.
      
      // 2. Upload to S3
      const fileName = crypto.randomBytes(16).toString("hex") + ".jpg";
      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `photos/${req.user.id}/${fileName}`,
        Body: buffer,
        ContentType: "image/jpeg",
        // ACL: 'public-read' // Optional if using bucket policy
      };

      const command = new PutObjectCommand(params);
      await s3.send(command);

      const image_url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/photos/${req.user.id}/${fileName}`;

      // 3. Database Operations (Airport, Aircraft, Photo)
      
      // ... (Same logic as before for Airport/Aircraft) ...
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
          return res.status(500).json({
            error: `Failed to insert airport: ${airportError.message}`,
          });
        }
        airport_code = airport_icao_code.toUpperCase();
      }

      // If uuid_rh is provided (reusing existing history), we skip creation.
      // Otherwise, we create new history or look it up.
      if (!uuid_rh) {
        if (aircraft_type_id) {
            // Create Specific Aircraft
            const { data: saData, error: saError } = await supabase
            .from("SpecificAircraft")
            .insert([{ icao_type: aircraft_type_id, manufactured_date }])
            .select()
            .single();

            if (saError) {
            return res.status(500).json({
                error: `Failed to insert specific aircraft: ${saError.message}`,
            });
            }

            // Create Registration History
            const { data: rhData, error: rhError } = await supabase
            .from("RegistrationHistory")
            .insert([
                {
                uuid_sa: saData.uuid,
                registration: registration.toUpperCase(),
                airline: airline_code,
                is_current: true, // Assuming new entries are current
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
            // Fallback: Try to find existing registration (should generally be handled by specific selection now)
            const { data: rhData, error: rhLookupError } = await supabase
            .from("RegistrationHistory")
            .select("uuid_rh")
            .eq("registration", registration.toUpperCase())
            .limit(1);

            if (rhLookupError) {
            return res.status(500).json({ error: rhLookupError.message });
            }
            if (!rhData || rhData.length === 0) {
            return res.status(404).json({
                error: "Registration not found. Please provide aircraft details.",
            });
            }
            uuid_rh = rhData[0].uuid_rh;
        }
      }

      // Insert Photo
      const { data, error } = await supabase
        .from("Photo")
        .insert([
          {
            user_id: req.user.id,
            uuid_rh: uuid_rh,
            airport_code,
            image_url, // S3 URL
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
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },
);

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("Photo")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);

    if (error) throw error;
    res.json({ message: "Photo deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
