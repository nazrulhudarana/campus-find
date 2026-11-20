const express = require('express');
const router = express.Router();
const {
  createItem,
  getItems,
  getItemById,
  getItemQrCode,
  verifySecurityPinAndReturn
} = require('../controllers/itemController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadItemPhotos } = require('../middleware/uploadMiddleware');

router.get('/', getItems);
router.get('/:id', getItemById);
router.get('/:id/qr', getItemQrCode);
router.post('/', protect, uploadItemPhotos.array('photos', 3), createItem);
router.post('/:id/verify-pin', protect, authorize('admin', 'security'), verifySecurityPinAndReturn);

module.exports = router;