const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');
const {
  createVideo,
  getVideos,
  getTrendingVideos,
  getVideoById,
  getVideosByAuthor,
  updateVideo,
  deleteVideo,
  toggleLikeVideo,
  toggleFavoriteVideo,
  shareVideo,
  adminDeleteVideo,
  adminGetAllVideos,
  adminReportVideo,
} = require('./khampha.controller');

// Admin routes (must be before /:videoId to avoid conflicts)
router.get('/admin/all', authenticate, requireAdmin, adminGetAllVideos);
router.delete('/admin/:videoId', authenticate, requireAdmin, adminDeleteVideo);
router.post('/admin/:videoId/report', authenticate, requireAdmin, adminReportVideo);

// Public routes
router.get('/', getVideos);
router.get('/trending', getTrendingVideos);
router.get('/author/:authorId', getVideosByAuthor);
router.get('/:videoId', getVideoById);

// Protected routes
router.post('/', authenticate, createVideo);
router.put('/:videoId', authenticate, updateVideo);
router.delete('/:videoId', authenticate, deleteVideo);
router.post('/:videoId/like', authenticate, toggleLikeVideo);
router.post('/:videoId/favorite', authenticate, toggleFavoriteVideo);
router.post('/:videoId/share', authenticate, shareVideo);

module.exports = router;
