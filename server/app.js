const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const JSZip = require('jszip');

const app = express();
app.use(cors());
app.use(express.json());

// Port configuration
const PORT = process.env.PORT || 3000;

// Date formatter inside Asia/Seoul timezone to guarantee YYYY-MM-DD HH:mm format
function getSeoulTimestamp() {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  // formatter.format(new Date()) returns "2026-07-11 12:45"
  return formatter.format(new Date()).replace('T', ' ');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: getSeoulTimestamp() });
});

// PDF generation endpoint
app.post('/api/generate-test-report', async (req, res) => {
  const reqId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  
  // Create distinct temporary directories for this request to avoid collisions
  const inputDir = path.join(os.tmpdir(), `lo-input-${reqId}`);
  const outputDir = path.join(os.tmpdir(), `lo-output-${reqId}`);
  const profileDir = path.join(os.tmpdir(), `lo-profile-${reqId}`);
  
  try {
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(profileDir, { recursive: true });
    
    const templatePath = path.join(__dirname, 'templates', 'report.docx');
    if (!fs.existsSync(templatePath)) {
      throw new Error('DOCX template file not found on server.');
    }
    
    // 1. Read the DOCX template file
    const docxData = fs.readFileSync(templatePath);
    
    // 2. Load with JSZip and modify word/document.xml
    const zip = await JSZip.loadAsync(docxData);
    let xmlText = await zip.file('word/document.xml').async('text');
    
    const timestamp = getSeoulTimestamp();
    
    // Replace the clean placeholder run we created
    if (!xmlText.includes('{{ISSUED_AT}}')) {
      throw new Error('Placeholder {{ISSUED_AT}} not found in DOCX template.');
    }
    xmlText = xmlText.split('{{ISSUED_AT}}').join(timestamp);
    
    // Update ZIP contents
    zip.file('word/document.xml', xmlText);
    const modifiedDocxBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Save modified DOCX to temp input path
    const tempDocxPath = path.join(inputDir, 'report.docx');
    fs.writeFileSync(tempDocxPath, modifiedDocxBuffer);
    
    // 3. Convert DOCX to PDF using LibreOffice headless command
    // Normalize path slash direction for Windows compatibility
    const normalizedProfileDir = profileDir.replace(/\\/g, '/');
    const loCommand = `soffice -env:UserInstallation="file:///${normalizedProfileDir}" --headless --convert-to pdf --outdir "${outputDir}" "${tempDocxPath}"`;
    
    await new Promise((resolve, reject) => {
      exec(loCommand, (err, stdout, stderr) => {
        if (err) {
          console.error('LibreOffice execution stdout:', stdout);
          console.error('LibreOffice execution stderr:', stderr);
          return reject(new Error('LibreOffice conversion failed: ' + err.message));
        }
        resolve();
      });
    });
    
    const tempPdfPath = path.join(outputDir, 'report.pdf');
    if (!fs.existsSync(tempPdfPath)) {
      throw new Error('LibreOffice conversion did not generate a PDF file.');
    }
    
    const pdfBytes = fs.readFileSync(tempPdfPath);
    if (pdfBytes.length < 100) {
      throw new Error('Generated PDF file size is invalid.');
    }
    
    // 4. Generate dynamic filename in YYYYMMDD_xxxxxx.pdf format
    const yyyymmdd = timestamp.split(' ')[0].replace(/-/g, '');
    const randomHex = Math.random().toString(16).substring(2, 8);
    const filename = `${yyyymmdd}_${randomHex}.pdf`;
    
    // Send response back
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBytes);
    
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  } finally {
    // 6. Cleanup temporary files and directories recursively
    try {
      fs.rmSync(inputDir, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Temporary directory cleanup error:', cleanupError);
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`PDF Generator server listening on port ${PORT}`);
});
