// routes/aircraft.js
const express = require("express");
const router = express.Router();
const supabase = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

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
        registration, 
        type_id,
        Photo!left (         
          image_url, 
          taken_at,
          airport_code
        )
      `,
      )
      .ilike("registration", `${query}%`)
      .eq("Photo.user_id", req.user.id)
      .limit(10);

    // restrict data.Photo to only the first photo (if any)
    for (let i = 0; i < data.length; i++) {
      if (data[i].Photo && data[i].Photo.length > 0) {
        data[i].Photo = [data[i].Photo[0]];
      }
    }

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
