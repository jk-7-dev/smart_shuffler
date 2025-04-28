// src/utils/csvUtils.js

/**
 * Parses a CSV file to extract track IDs from a 'trackId' column.
 * Assumes a simple CSV structure without complex quoting or escaped commas within fields.
 * @param {File} file - The CSV file object from an input element.
 * @param {function(Array<string>, string|null)} callback - The callback function.
 * It receives two arguments:
 * - An array of extracted track IDs.
 * - An error message string if parsing fails, otherwise null.
 */
export const parseCsvFile = (file, callback) => {
  // Added more robust file type check
  if (!file || !(file.type === 'text/csv' || file.name?.toLowerCase().endsWith('.csv'))) {
      callback([], 'Please upload a valid CSV file (.csv extension).');
      return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = e.target.result;
      // Robust splitting: handles different line endings (\n, \r\n)
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line);

      if (lines.length < 2) {
        callback([], 'CSV file must contain a header row and at least one data row.');
        return;
      }

      // Simple comma splitting for headers, assumes no commas in headers themselves
      const headers = lines[0].split(',').map(h => h.trim());
      const trackIdIndex = headers.indexOf('trackId');

      if (trackIdIndex === -1) {
        callback([], 'CSV file must include a header row with a "trackId" column.');
        return;
      }

      const ids = lines.slice(1).map(line => {
        // Simple comma splitting for data rows.
        // WARNING: This basic split will fail if track IDs or other columns could contain commas.
        // A more robust CSV parser library might be needed for complex CSVs.
        const cols = line.split(',');
        // Ensure the column exists before trying to access/trim it
        return cols.length > trackIdIndex ? (cols[trackIdIndex] || '').trim() : null;
      }).filter(id => id); // Filter out empty/null IDs

      callback(ids, null); // Success
    } catch (error) {
        console.error("Error reading or processing CSV:", error);
        callback([], `Failed to process CSV file: ${error.message}`);
    }
  };

  reader.onerror = (e) => {
      console.error("FileReader error:", reader.error);
      callback([], `Error reading file: ${reader.error?.message || 'Unknown file read error'}`);
  }

  reader.readAsText(file);
};


// --- CSV Export Functionality ---

/**
 * Helper function to escape a field for CSV format according to RFC 4180 rules.
 * - Encloses fields containing commas, double quotes, or newlines in double quotes.
 * - Escapes existing double quotes within the field by doubling them ("").
 * @param {*} field - The value to escape. Converts null/undefined to empty string.
 * @returns {string} The CSV-safe field string.
 */
const escapeCsvField = (field) => {
  const stringField = String(field ?? ''); // Ensure it's a string, handle null/undefined
  // Check if quoting is necessary
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
    // Enclose in double quotes and double up internal double quotes
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  // No quoting needed
  return stringField;
};

/**
 * Formats track data from Spotify API into a CSV string and triggers a browser download.
 * @param {Array<object>} trackItems - Array of track items from Spotify API (e.g., [{ track: {...} }, ...]).
 * @param {string} playlistName - The name of the playlist, used for the filename base.
 */
export const exportTracksToCsv = (trackItems, playlistName) => {
  if (!Array.isArray(trackItems)) {
      console.error("exportTracksToCsv: Invalid input. 'trackItems' must be an array.");
      alert("Failed to export: Invalid track data received.");
      return;
  }
  if (trackItems.length === 0) {
    console.warn("No track items provided for CSV export.");
    // Optionally alert the user if called unexpectedly with empty array
    // alert("Cannot export: The playlist appears to be empty or tracks are missing.");
    return;
  }

  // Define CSV Headers (ensure order matches rows below)
  const headers = [
    "Track Name",
    "Artists",
    "Album",
    "Duration (ms)",
    "Spotify ID"
    // Example: Add more fields if needed
    // "Album Artist",
    // "Disc Number",
    // "Track Number",
    // "Popularity",
    // "ISRC" // Note: ISRC might not always be available via standard track endpoint
  ].map(escapeCsvField); // Escape headers too, just in case

  // Map track items to CSV data rows
  const rows = trackItems.map(item => {
    // Check if item and item.track exist
    if (!item?.track) return null;

    const track = item.track;
    // Safely access nested properties and provide defaults
    const trackName = track.name ?? '';
    // Join multiple artists with a semicolon, as artist names could contain commas
    const artists = track.artists?.map(artist => artist.name).join('; ') ?? '';
    const albumName = track.album?.name ?? '';
    const duration = track.duration_ms ?? '';
    const spotifyId = track.id ?? '';
    // Example: Accessing more fields (ensure they exist in your fetched data)
    // const albumArtist = track.album?.artists?.map(a => a.name).join('; ') ?? '';
    // const discNumber = track.disc_number ?? '';
    // const trackNumber = track.track_number ?? '';
    // const popularity = track.popularity ?? ''; // Requires separate API call or different endpoint usually
    // const isrc = track.external_ids?.isrc ?? '';

    // Return array of fields, ensuring order matches headers
    // Escape each field individually
    return [
      escapeCsvField(trackName),
      escapeCsvField(artists),
      escapeCsvField(albumName),
      escapeCsvField(duration),
      escapeCsvField(spotifyId)
      // escapeCsvField(albumArtist),
      // escapeCsvField(discNumber),
      // escapeCsvField(trackNumber),
      // escapeCsvField(popularity),
      // escapeCsvField(isrc)
    ];
  }).filter(row => row !== null); // Filter out any null rows from missing track data

  // Combine header and rows into a single CSV string
  const csvString = [
    headers.join(','),
    ...rows.map(row => row.join(',')) // Join fields in each data row
  ].join('\n'); // Join header and data rows with newline

  // --- Trigger Download ---
  try {
    // Create a Blob (Binary Large Object) with UTF-8 BOM for better Excel compatibility
    const BOM = "\uFEFF"; // UTF-8 Byte Order Mark
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });

    // Create a temporary link element
    const link = document.createElement("a");

    // Create a downloadable URL for the blob
    const url = URL.createObjectURL(blob);

    // Sanitize filename (replace potentially invalid filesystem characters)
    const safeFilename = playlistName.replace(/[<>:"/\\|?*]+/g, '_') || 'playlist_export'; // Ensure fallback name
    link.setAttribute("href", url);
    link.setAttribute("download", `${safeFilename}.csv`);

    // Append link, trigger click, and remove link
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the object URL
    URL.revokeObjectURL(url);

  } catch (error) {
      console.error("Error triggering CSV download:", error);
      alert("Could not initiate the file download.");
  }
};