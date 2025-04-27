// src/utils/csvUtils.js

/**
 * Parses a CSV file to extract track IDs from a 'trackId' column.
 *
 * @param {File} file - The CSV file object from an input element.
 * @param {function(Array<string>, string|null)} callback - The callback function.
 * It receives two arguments:
 * - An array of extracted track IDs.
 * - An error message string if parsing fails, otherwise null.
 */
export const parseCsvFile = (file, callback) => {
    if (!file || !file.type.includes('csv')) {
        callback([], 'Please upload a valid CSV file.');
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
  
        // Simple comma splitting, assumes no commas within fields
        const headers = lines[0].split(',').map(h => h.trim());
        const trackIdIndex = headers.indexOf('trackId');
  
        if (trackIdIndex === -1) {
          callback([], 'CSV file must include a header row with a "trackId" column.');
          return;
        }
  
        const ids = lines.slice(1).map(line => {
          // Simple comma splitting
          const cols = line.split(',');
          return cols[trackIdIndex] ? cols[trackIdIndex].trim() : null; // Trim ID
        }).filter(id => id); // Filter out empty/null IDs
  
        callback(ids, null); // Success
      } catch (error) {
          console.error("Error reading or processing CSV:", error);
          callback([], `Failed to process CSV file: ${error.message}`);
      }
    };
  
    reader.onerror = (e) => {
        console.error("FileReader error:", reader.error);
        callback([], `Error reading file: ${reader.error.message}`);
    }
  
    reader.readAsText(file);
  };