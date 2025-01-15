const express = require("express");
const multer = require("multer");
const fs = require("fs");
const https = require("https");
const { createClient } = require("@deepgram/sdk");

require("dotenv").config();

// Configure Multer

// Initialize Deepgram client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Initialize Express app
const app = express();

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" });
app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url, req.headers);
  next();
});

// Middleware to validate `x-api-key` header
/* app.use((req, res, next) => {
  const clientApiKey = req.headers["x-api-key"];
  if (!clientApiKey || clientApiKey !== process.env.X_API_KEY) {
    return res.status(403).json({ error: "Unauthorized: Invalid API Key" });
  }
  next();
}); */

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer Error:", err.message);
    return res.status(400).json({ error: err.message });
  }
  console.error("Unexpected Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Route to transcribe audio files
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    // Ensure a file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;

    // Send audio data to Deepgram
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fs.createReadStream(filePath),
      {
        model: "nova-2",
      }
    );
    if (error) {
      throw new Error(`Failed to process transcription: ${error.message}`);
    }
    // Cleanup uploaded file
    fs.unlinkSync(filePath);

    const filteredResult =
      result.results.channels[0].alternatives[0].transcript;
    // Return transcription result
    res.json({
      result: filteredResult,
    });
  } catch (error) {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to delete file:", err.message);
      });
    }
    console.error("Error processing transcription:", error.message);
    res.status(500).json({ error: "Failed to process transcription" });
  }
});

app.post("/create-text-file", (req, res) => {
  const __dirname = path.resolve();
  if (!fs.existsSync(`${__dirname}/output`)) {
    fs.mkdirSync(`${__dirname}/output`);
  }
  if (!req.body.text) {
    return res.status(400).json({ error: "Missing text content" });
  }
  if (!req.body.fileName) {
    return res.status(400).json({ error: "Missing file name" });
  }
  const textString = req.body.text; // Assuming the text is sent in the request body
  const fileName = req.body.fileName || "file"; // Default file name
  const nowDate = new Date();
  const day = nowDate.getDate();
  const month = nowDate.getMonth() + 1; // Months are zero-based
  const year = nowDate.getFullYear();
  const timestamp = nowDate.getTime();
  const dirname = `${__dirname}/output/${year}-${month}-${day}/`;
  const textFileName = `${fileName}-${timestamp}.txt`;
  console.log("Creating text file:", textFileName);
  if (!textString) {
    return res.status(400).json({ error: "Missing text content" });
  }

  // Ensure the directory exists
  fs.mkdirSync(dirname, { recursive: true });

  // Write the text string to a file
  fs.writeFileSync(dirname + textFileName, textString);

  // Set the appropriate headers for file download
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${textFileName}"`
  );
  res.setHeader("Content-Type", "text/plain");

  // Send the file as the response
  console.log("Sending file:", dirname + textFileName);
  res.sendFile(dirname + textFileName);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
