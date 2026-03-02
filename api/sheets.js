// Vercel Serverless Function — proxies Smartsheet API calls server-side
// Reads SMARTSHEET_TOKEN from Vercel environment variables (no CORS issues)

const SHEETS = [
  { id: "3225235240210308", name: "January 2026" },
  { id: "7095653608935300", name: "February 2026" },
  { id: "7728834867580804", name: "March 2026" },
  { id: "83655641747332",   name: "April 2026" },
  { id: "58332514570116",   name: "May 2026" },
  { id: "2943347946639236", name: "June 2026" },
];

async function fetchSheet(token, sheetId, sheetName) {
  const resp = await fetch(`https://api.smartsheet.com/2.0/sheets/${sheetId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Sheet "${sheetName}": ${err.message || resp.status}`);
  }
  const data = await resp.json();
  const colMap = {};
  for (const c of data.columns || []) colMap[c.id] = c.title;

  return (data.rows || [])
    .map((row) => {
      const cells = {};
      for (const c of row.cells || []) {
        cells[colMap[c.columnId]] = c.displayValue || c.value || "";
      }
      const eventName = (cells["Project/Event Name"] || "").trim();
      if (!eventName) return null;
      return {
        month: sheetName.split(" ")[0],
        fullMonth: sheetName,
        eventName,
        requirements: cells["Requirements"] || "",
        status: cells["Status"] || "",
        owner: cells["Owner"] || "",
        assignedTo: cells["Assigned To"] || "",
        startDate: String(cells["Anticipated Start Date"] || ""),
        endDate: String(cells["Anticipated End Date"] || ""),
      };
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  // Allow GET only
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: "SMARTSHEET_TOKEN environment variable not configured. Add it in Vercel → Settings → Environment Variables.",
    });
  }

  try {
    const allRows = [];
    for (const sheet of SHEETS) {
      const rows = await fetchSheet(token, sheet.id, sheet.name);
      allRows.push(...rows);
    }
    // Cache for 60 seconds on Vercel edge
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ rows: allRows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
