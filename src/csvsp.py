import pandas as pd

# Load the original CSV
df = pd.read_csv("your_file.csv")

# Keep only the first 800 rows
df = df.head(800)

# Split into 8 CSVs with 100 rows each
for i in range(8):
    chunk = df[i*100:(i+1)*100]
    chunk.to_csv(f"split_{i+1}.csv", index=False)

print("CSV split completed. 8 files of 100 rows each created. Remaining 8 rows discarded.")
