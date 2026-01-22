// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const supabase = require("../db");

const generateJWT = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      type: user.type,
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );
};

router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 1. Insert User
    // Note: We don't need to pass 'type' here; the DB defaults it to 'user'
    const { data, error } = await supabase
      .from("User")
      .insert([{ username, password_hash: passwordHash, type: "user" }])
      .select()
      .single();

    if (error) throw error;

    // 2. Generate Token with 'type'
    const token = generateJWT(data);

    res.status(201).json({
      message: "User created successfully",
      token,
      user: { id: data.id, username: data.username, type: data.type },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from("User")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const token = generateJWT(user);

    res.json({
      token,
      user: { id: user.id, username: user.username, type: user.type },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
