import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { PATHS } from '../config.mjs';

let connection;

export function db(path = PATHS.database) {
  if (connection) return connection;
  mkdirSync(dirname(path), { recursive: true });
  connection = new Database(path);
  connection.pragma('journal_mode = WAL');
  connection.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      source_job_id TEXT,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT,
      description TEXT,
      job_url TEXT NOT NULL,
      apply_url TEXT NOT NULL,
      posted_at TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      description_hash TEXT NOT NULL,
      identity_hash TEXT NOT NULL UNIQUE,
      source_confidence INTEGER NOT NULL DEFAULT 70,
      eligibility TEXT NOT NULL DEFAULT 'pending',
      exclusion_reason TEXT,
      sponsorship_signal TEXT NOT NULL DEFAULT 'unknown'
    );
    CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_id ON jobs(source, source_job_id) WHERE source_job_id <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS jobs_url ON jobs(job_url);
    CREATE TABLE IF NOT EXISTS job_observations (
      id INTEGER PRIMARY KEY,
      job_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      source_job_id TEXT,
      job_url TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      description_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY,
      job_id INTEGER NOT NULL UNIQUE,
      scoring_version TEXT NOT NULL,
      ats_score REAL NOT NULL,
      ats_rating TEXT,
      parsing_score REAL,
      match_score REAL,
      recruiter_score REAL,
      fit_score REAL NOT NULL,
      recency_score REAL NOT NULL,
      rank_score REAL NOT NULL,
      matched_skills TEXT,
      missing_skills TEXT,
      knockout_signals TEXT,
      summary TEXT,
      claude_review TEXT,
      evaluated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY,
      job_id INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'queued',
      preparation_report TEXT,
      review_token TEXT,
      reviewed_at TEXT,
      submitted_at TEXT,
      final_url TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_runs (
      id INTEGER PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      dry_run INTEGER NOT NULL DEFAULT 0,
      fetched_count INTEGER NOT NULL DEFAULT 0,
      qualified_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      summary TEXT
    );
    CREATE TABLE IF NOT EXISTS source_health (
      source TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      last_checked_at TEXT NOT NULL,
      job_count INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
  `);
  return connection;
}

export function resetDbForTests() {
  connection?.close();
  connection = undefined;
}
