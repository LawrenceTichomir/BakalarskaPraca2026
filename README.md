The application compares three traditional OCR approaches:

Template Matching
- Compares input image with predefined templates
- Uses pixel-wise similarity
- Simple but sensitive to variations

Histogram Method (Projection Profiles)
- Analyzes distribution of pixels across rows and columns
- Uses vector similarity (cosine similarity)
- More robust to small distortions

Zoning Method
- Divides image into regions (grid)
- Extracts density features per zone
- Compares structural patterns of digits

User input goes through a full preprocessing pipeline:
1. Drawing input (canvas)
2. Grayscale conversion
3. Thresholding (binarization)
4. Bounding box detection
5. Centering and padding
6. Resizing to 28×28
7. Conversion to normalized vector

Each step is visually displayed in the application.
