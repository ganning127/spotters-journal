require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const photoRoutes = require("./routes/photos");
const airportRoutes = require("./routes/airports");
const aircraftTypeRoutes = require("./routes/aircraftTypes");
const aircraftRoutes = require("./routes/aircraft");

const app = express();

app.use(cors()); // Allow frontend to communicate
app.use(express.json()); // Parse JSON bodies

app.use("/api/auth", authRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/airports", airportRoutes);
app.use("/api/aircraft-types", aircraftTypeRoutes);
app.use("/api/aircraft", aircraftRoutes);

app.get("/", (req, res) => {
  res.send("Plane Tracker API is running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
