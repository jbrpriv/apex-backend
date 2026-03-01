const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Settings = require('../models/Settings');
const authMiddleware = require('../middleware/auth');

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer + Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'apex-manager',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }]
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// GET background URL (public — needed on login page before auth)
router.get('/background', async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: 'background_url' });
    res.json({ url: setting ? setting.value : null });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST upload new background (protected)
router.post('/background', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const imageUrl = req.file.path;

    await Settings.findOneAndUpdate(
      { key: 'background_url' },
      { key: 'background_url', value: imageUrl },
      { upsert: true, new: true }
    );

    res.json({ url: imageUrl, message: 'Background updated!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE background (reset to default)
router.delete('/background', authMiddleware, async (req, res) => {
  try {
    await Settings.findOneAndDelete({ key: 'background_url' });
    res.json({ message: 'Background reset to default' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
