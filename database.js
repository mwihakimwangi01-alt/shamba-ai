const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "shamba.db"));

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Create a default farmer so reports always have a valid farmer_id
db.exec(`
  CREATE TABLE IF NOT EXISTS farmers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS farm_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id INTEGER,
    crop TEXT NOT NULL,
    field_size REAL,
    yield_kg REAL,
    rainfall_mm REAL,
    temperature REAL,
    soil_ph REAL,
    fertilizer_used TEXT,
    report_date DATE DEFAULT (date('now')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id)
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id INTEGER,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plant_diagnoses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id INTEGER,
    image_path TEXT,
    crop TEXT,
    diagnosis TEXT,
    recommendations TEXT,
    severity TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default farmer if not exists
const existing = db.prepare("SELECT id FROM farmers WHERE id = 1").get();
if (!existing) {
  db.prepare("INSERT INTO farmers (name, location) VALUES (?, ?)").run("Default Farmer", "Kenya");
}

module.exports = db;