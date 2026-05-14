require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const db = require("./db/database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Multer storage for plant images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public/uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `plant_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Images only"));
  },
});

// Helper function to call Groq API
async function callGroq(prompt, imageFile = null) {
  const apiKey = process.env.GROQ_API_KEY;

  const messages = [
    {
      role: "system",
      content: "You are Shamba AI, an expert farming assistant for African farmers. Give practical, actionable advice. Be friendly and simple. Focus on crops common in East Africa like maize, beans, tomatoes, tea, coffee, sugarcane."
    },
    {
      role: "user",
      content: imageFile
        ? `${prompt}\n\n[Note: A farmer uploaded a plant image for diagnosis. Please provide general plant disease diagnosis advice for East African crops since you cannot see the image directly.]`
        : prompt
    }
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 1024,
      temperature: 0.7
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

// Chat route
app.post("/api/chat", upload.single("image"), async (req, res) => {
  try {
    const { message, farmer_id } = req.body;
    const imageFile = req.file;

    const prompt = message || "A farmer uploaded a plant image. Please provide general advice on common plant diseases and what farmers should look out for in East Africa.";

    db.prepare("INSERT INTO chat_history (farmer_id, role, content, image_path) VALUES (?, ?, ?, ?)")
      .run(farmer_id || 1, "user", prompt, imageFile ? imageFile.filename : null);

    const aiReply = await callGroq(prompt, imageFile);

    db.prepare("INSERT INTO chat_history (farmer_id, role, content) VALUES (?, ?, ?)")
      .run(farmer_id || 1, "assistant", aiReply);

    if (imageFile) {
      db.prepare("INSERT INTO plant_diagnoses (farmer_id, image_path, diagnosis) VALUES (?, ?, ?)")
        .run(farmer_id || 1, imageFile.filename, aiReply);
    }

    res.json({ reply: aiReply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong: " + err.message });
  }
});

// Save farm report
app.post("/api/farm/report", (req, res) => {
  try {
    const { farmer_id, crop, field_size, yield_kg, rainfall_mm, temperature, soil_ph, fertilizer_used, notes } = req.body;
    db.prepare(`INSERT INTO farm_reports (farmer_id, crop, field_size, yield_kg, rainfall_mm, temperature, soil_ph, fertilizer_used, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(farmer_id || 1, crop, field_size, yield_kg, rainfall_mm, temperature, soil_ph, fertilizer_used, notes);
    res.json({ success: true, message: "Report saved!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all reports
app.get("/api/farm/reports", (req, res) => {
  const reports = db.prepare("SELECT * FROM farm_reports ORDER BY created_at DESC").all();
  res.json(reports);
});

// Get chat history
app.get("/api/chat/history", (req, res) => {
  const history = db.prepare("SELECT * FROM chat_history ORDER BY created_at ASC").all();
  res.json(history);
});

// Analytics summary
app.get("/api/analytics/summary", (req, res) => {
  const totalReports = db.prepare("SELECT COUNT(*) as count FROM farm_reports").get();
  const avgYield = db.prepare("SELECT AVG(yield_kg) as avg FROM farm_reports").get();
  const crops = db.prepare("SELECT crop, COUNT(*) as count FROM farm_reports GROUP BY crop").all();
  const yieldTrend = db.prepare("SELECT report_date, crop, yield_kg FROM farm_reports ORDER BY report_date ASC").all();
  res.json({ totalReports: totalReports.count, avgYield: avgYield.avg, crops, yieldTrend });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Shamba AI is running 🌱" });
});

// Serve frontend
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  console.log(`🌱 Shamba AI running on http://localhost:${PORT}`);
});