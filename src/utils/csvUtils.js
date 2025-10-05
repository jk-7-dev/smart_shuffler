// src/utils/csvUtils.js

/**
 * Parses a CSV file expecting a 'trackId' column.
 * Handles basic CSV structure.
 * @param {File} file - The CSV file object from an input element.
 * @param {function(Array<string>, string|null)} callback - Receives (ids, error).
 */
export const parseCsvFile = (file, callback) => {
  // File type check
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
        callback([], 'CSV file (ID) must contain a header row and at least one data row.');
        return;
      }

      // Process header: lowercase, trim, remove quotes
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const trackIdIndex = headers.indexOf('trackid'); // Find 'trackid' header

      if (trackIdIndex === -1) {
        callback([], 'CSV file (ID) must include a header row with a "trackId" column.');
        return;
      }

      // Process data rows
      const ids = lines.slice(1).map(line => {
        // WARNING: Simple split, may fail with commas in fields
        const cols = line.split(',');
        // Safely get data, trim, remove quotes
        return cols.length > trackIdIndex ? (cols[trackIdIndex] || '').trim().replace(/^"|"$/g, '') : null;
      }).filter(id => id); // Filter out empty IDs

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

  reader.readAsText(file); // Use default encoding, or specify if needed e.g., reader.readAsText(file, 'UTF-8');
};


/**
 * Parses a CSV file expecting at least a 'song_title' column (or similar variations).
 * Extracts ONLY the title for searching.
 * @param {File} file - The CSV file object.
 * @param {function(Array<object>, string|null)} callback - Receives (trackMetadataArray, error).
 * Each object in array: { title: string }
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

            // Process header: lowercase, trim, remove quotes
            const headerLine = lines[0];
            const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));

            // Find index of the title column (accepting common variations)
            const titleIndex = headers.findIndex(h => ['song_title', 'track', 'title', 'name', 'song'].includes(h));

            // Check if essential 'title' column is present
            if (titleIndex === -1) {
                callback([], 'Metadata CSV header must contain a column for the song title (e.g., "song_title", "track", "title", "name").');
                return;
            }
            // No need to check for artist/album anymore

            // Process data rows
            const trackMetadataArray = lines.slice(1).map((line, index) => {
                // WARNING: Simple split, may fail with commas in fields
                const cols = line.split(',');

                // Helper to safely get and clean column data
                const getColData = (colIndex) => {
                    return colIndex !== -1 && cols.length > colIndex ? (cols[colIndex] || '').trim().replace(/^"|"$/g, '') : '';
                };

                const title = getColData(titleIndex);

                // Skip row if title is missing
                if (!title) {
                    console.warn(`Skipping row ${index + 2}: Missing song title.`);
                    return null;
                }

                // --- UPDATED: Return object containing ONLY the title ---
                return { title };
                // ------------------------------------------------------
            }).filter(data => data !== null); // Filter out skipped rows

            if (trackMetadataArray.length === 0) {
                 callback([], 'No valid track titles found in the CSV.');
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

    reader.readAsText(file); // Use default encoding
};


// --- CSV Export Functionality ---

/**
 * Helper function to escape a field for CSV format according to RFC 4180 rules.
 * @param {*} field - The value to escape. Converts null/undefined to empty string.
 * @returns {string} The CSV-safe field string.
 */
const escapeCsvField = (field) => {
  const stringField = String(field ?? '');
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
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

  const headers = [
    "Track Name", "Artists", "Album", "Duration (ms)", "Spotify ID"
  ].map(escapeCsvField);

  const rows = trackItems.map(item => {
    if (!item?.track) return null;
    const track = item.track;
    const trackName = track.name ?? '';
    const artists = track.artists?.map(artist => artist.name).join('; ') ?? '';
    const albumName = track.album?.name ?? '';
    const duration = track.duration_ms ?? '';
    const spotifyId = track.id ?? '';
    return [
      escapeCsvField(trackName), escapeCsvField(artists), escapeCsvField(albumName),
      escapeCsvField(duration), escapeCsvField(spotifyId)
    ];
  }).filter(row => row !== null);

  const csvString = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  try {
    const BOM = "\uFEFF"; // UTF-8 BOM
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
