// src/utils/csvUtils.js

/**
 * Parses a CSV file expecting a 'trackId' column.
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
        callback([], 'CSV file (ID) must contain a header row and at least one data row.');
        return;
      }

      // Simple comma splitting for headers, assumes no commas in headers themselves
      // Convert headers to lowercase for case-insensitive matching
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const trackIdIndex = headers.indexOf('trackid'); // Check lowercase 'trackid'

      if (trackIdIndex === -1) {
        callback([], 'CSV file (ID) must include a header row with a "trackId" column.');
        return;
      }

      const ids = lines.slice(1).map(line => {
        // Simple comma splitting for data rows.
        // WARNING: This basic split will fail if track IDs or other columns could contain commas.
        const cols = line.split(',');
        // Ensure the column exists before trying to access/trim it
        return cols.length > trackIdIndex ? (cols[trackIdIndex] || '').trim().replace(/^"|"$/g, '') : null;
      }).filter(id => id); // Filter out empty/null IDs

      callback(ids, null); // Success
    } catch (error) {
        console.error("Error reading or processing ID CSV:", error);
        callback([], `Failed to process ID CSV file: ${error.message}`);
    }
  };

  reader.onerror = (e) => {
      console.error("FileReader error:", reader.error);
      callback([], `Error reading file: ${reader.error?.message || 'Unknown file read error'}`);
  }

  reader.readAsText(file);
};


/**
 * Parses a CSV file expecting metadata columns like 'song_title', 'song_singer', 'movie'.
 * Handles basic CSV structure; may struggle with commas within quoted fields.
 * @param {File} file - The CSV file object.
 * @param {function(Array<object>, string|null)} callback - Receives (trackMetadataArray, error).
 * Each object in array: { title, artist, album }
 */
export const parseMetadataCsv = (file, callback) => {
    if (!file || !(file.type === 'text/csv' || file.name?.toLowerCase().endsWith('.csv'))) {
        callback([], 'Please upload a valid CSV file (.csv extension).');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line);

            if (lines.length < 2) {
                callback([], 'Metadata CSV must contain a header row and at least one data row.');
                return;
            }

            // Process header row - handle potential quotes and convert to lowercase
            const headerLine = lines[0];
            // Basic CSV header split (doesn't handle quoted commas well)
            const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));

            // Find indices of required/optional columns (adjust names based on common variations)
            const titleIndex = headers.findIndex(h => ['song_title', 'track', 'title', 'name', 'song'].includes(h));
            const artistIndex = headers.findIndex(h => ['song_singer', 'artist', 'artists', 'singer'].includes(h));
            const albumIndex = headers.findIndex(h => ['movie', 'album', 'albumtitle'].includes(h));

            // Check if essential 'title' column is present
            if (titleIndex === -1) {
                callback([], 'Metadata CSV header must contain a column for the song title (e.g., "song_title", "track", "title", "name").');
                return;
            }
            // Warn if optional columns are missing
            if (artistIndex === -1) {
                 console.warn('Metadata CSV missing an artist column (e.g., "song_singer", "artist"), search results may be less accurate.');
            }
             if (albumIndex === -1) {
                 console.warn('Metadata CSV missing an album column (e.g., "movie", "album"), search results may be less accurate.');
            }

            const trackMetadataArray = lines.slice(1).map((line, index) => {
                // Basic CSV data split (doesn't handle quoted commas well)
                const cols = line.split(',');

                // Helper to safely get and clean column data
                const getColData = (colIndex) => {
                    return colIndex !== -1 && cols.length > colIndex ? (cols[colIndex] || '').trim().replace(/^"|"$/g, '') : '';
                };

                const title = getColData(titleIndex);
                // Use first listed artist if multiple are semicolon/comma-separated within the field
                const artist = getColData(artistIndex).split(/[,;]/)[0].trim(); // Take first artist before comma/semicolon
                const album = getColData(albumIndex);

                if (!title) {
                    console.warn(`Skipping row ${index + 2}: Missing song title.`);
                    return null; // Skip row if title is missing
                }

                // Return object with extracted metadata, ready for search
                return { title, artist, album };
            }).filter(data => data !== null); // Filter out skipped rows

            if (trackMetadataArray.length === 0) {
                 callback([], 'No valid track metadata found in the CSV.');
                 return;
            }

            callback(trackMetadataArray, null); // Success

        } catch (error) {
            console.error("Error reading or processing metadata CSV:", error);
            callback([], `Failed to process metadata CSV file: ${error.message}`);
        }
    };

    reader.onerror = (e) => {
        console.error("FileReader error:", reader.error);
        callback([], `Error reading file: ${reader.error?.message || 'Unknown file read error'}`);
    };

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
    return;
  }

  // Define CSV Headers (ensure order matches rows below)
  const headers = [
    "Track Name",
    "Artists",
    "Album",
    "Duration (ms)",
    "Spotify ID"
  ].map(escapeCsvField); // Escape headers too

  // Map track items to CSV data rows
  const rows = trackItems.map(item => {
    if (!item?.track) return null; // Skip if track data is missing

    const track = item.track;
    const trackName = track.name ?? '';
    // Join multiple artists with a semicolon
    const artists = track.artists?.map(artist => artist.name).join('; ') ?? '';
    const albumName = track.album?.name ?? '';
    const duration = track.duration_ms ?? '';
    const spotifyId = track.id ?? '';

    // Return array of fields, escaping each
    return [
      escapeCsvField(trackName),
      escapeCsvField(artists),
      escapeCsvField(albumName),
      escapeCsvField(duration),
      escapeCsvField(spotifyId)
    ];
  }).filter(row => row !== null); // Filter out skipped rows

  // Combine header and rows
  const csvString = [
    headers.join(','),
    ...rows.map(row => row.join(',')) // Join fields in each data row
  ].join('\n'); // Join all rows with newline

  // --- Trigger Download ---
  try {
    const BOM = "\uFEFF"; // UTF-8 Byte Order Mark for Excel compatibility
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const safeFilename = playlistName.replace(/[<>:"/\\|?*]+/g, '_') || 'playlist_export';
    link.setAttribute("href", url);
    link.setAttribute("download", `${safeFilename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
      console.error("Error triggering CSV download:", error);
      alert("Could not initiate the file download.");
  }
};
