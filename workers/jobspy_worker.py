#!/usr/bin/env python3
import json
import sys
from jobspy import scrape_jobs

def value(record, key):
    item = record.get(key)
    return None if item != item else item

def main():
    request = json.load(sys.stdin)
    jobs = scrape_jobs(
        site_name=request.get("sites", ["indeed", "google"]),
        search_term=request.get("term"),
        google_search_term=request.get("google_term"),
        location=request.get("location", "United States"),
        results_wanted=request.get("results", 25),
        hours_old=request.get("hours_old", 168),
        country_indeed="USA",
        description_format="markdown",
    )
    rows = []
    for record in jobs.to_dict(orient="records"):
        rows.append({
            "source": f"jobspy:{value(record, 'site')}",
            "source_job_id": str(value(record, "id") or ""),
            "company": value(record, "company") or "",
            "title": value(record, "title") or "",
            "location": value(record, "location") or "",
            "description": value(record, "description") or "",
            "job_url": value(record, "job_url") or "",
            "apply_url": value(record, "job_url_direct") or value(record, "job_url") or "",
            "posted_at": str(value(record, "date_posted") or ""),
            "source_confidence": 55,
        })
    json.dump({"jobs": rows}, sys.stdout)

if __name__ == "__main__":
    main()
