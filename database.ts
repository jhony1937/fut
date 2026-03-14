import pg from 'pg';

const { Pool } = pg;

// Connection pool configuration using environment variable from Railway
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Initializes the database and creates the 'players' table if it doesn't exist.
 */
export async function initDatabase() {
  const query = `
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE,
      wins INTEGER DEFAULT 0,
      goals INTEGER DEFAULT 0,
      assists INTEGER DEFAULT 0,
      rank TEXT DEFAULT 'Unranked',
      elo INTEGER DEFAULT 0
    );
    ALTER TABLE players ADD COLUMN IF NOT EXISTS assists INTEGER DEFAULT 0;
  `;
  try {
    await pool.query(query);
    console.log("Database initialized and 'players' table is ready.");
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}

/**
 * Executes a query on the database.
 * @param text SQL query string
 * @param params Query parameters for safe execution
 */
export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
