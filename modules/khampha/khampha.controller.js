const { Khampha } = require('./khampha.model');
const User = require('../user/user.model');
const { EncryptedFile } = require('../upload/encrypted-file.model');
const Notification = require('../notification/notification.model');
const uploadService = require('../../services/upload.service');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper function to emit socket event
const emitSocketEvent = (io, event, data) => {
  if (io) {
    io.to('khampha').emit(event, data);
  }
};

// Create a new short video with EncryptedFile support for streaming
const createVideo = async (req, res) => {
    try {
        const userId = req.userId;
        const {
            videoUrl,
            thumbnailUrl,
            caption,
            music,
            hashtags,
            mentions,
            location,
            duration,
            allowComments,
            allowDuet,
            allowStitch
        } = req.body;

        const MAX_DURATION_SECONDS = 5 * 60;

        console.log('Received video URL:', videoUrl);
        console.log('Received duration from frontend:', duration);
        console.log('Request body:', req.body);

        // Backend validation
        if (duration && duration > MAX_DURATION_SECONDS) {
            return res.status(400).json({
                success: false,
                message: `Video quá dài! Vui lòng chọn video tối đa ${MAX_DURATION_SECONDS / 60} phút`,
            });
        }

        const video = new Khampha({
            videoUrl,
            thumbnailUrl,
            caption,
            author: userId,
            music: music || null,
            hashtags: hashtags || [],
            mentions: mentions || [],
            location: location || null,
            duration: duration || 0,
            allowComments: allowComments !== undefined ? allowComments : true,
            allowDuet: allowDuet !== undefined ? allowDuet : true,
            allowStitch: allowStitch !== undefined ? allowStitch : true,
        });

        await video.save();

        console.log('Saved video with duration:', video.duration);

        // Populate author data
        await video.populate('author', 'fullName username avatar role followers following');

        // Emit socket event
        const io = req.app.get('io');
        emitSocketEvent(io, 'khampha:video-created', {
            videoId: video._id,
            video,
        });

        res.status(201).json({
            success: true,
            message: 'Đăng video thành công',
            data: video,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đăng video',
            error: error.message,
        });
    }
};

// Get all short videos (feed)
const getVideos = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const videos = await Khampha.find({ isDeleted: false, isReported: false })
            .populate('author', 'fullName username avatar role followers following')
            .populate('mentions', 'fullName username avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Add streamUrl to each video
        const videosWithStreamUrl = videos.map(video => {
            const videoObj = video.toObject();
            // Extract messageId from videoUrl if available
            if (videoObj.videoUrl) {
                const urlParts = videoObj.videoUrl.split('/');
                const messageId = urlParts[urlParts.length - 1];
                if (messageId && !isNaN(parseInt(messageId))) {
                    videoObj.streamUrl = videoObj.videoUrl; // Just use the same URL since it already goes through proxy
                }
            }
            return videoObj;
        });

        const total = await Khampha.countDocuments({ isDeleted: false, isReported: false });

        res.json({
            success: true,
            data: videosWithStreamUrl,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách video',
            error: error.message,
        });
    }
};

// Get trending videos
const getTrendingVideos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const videos = await Khampha.find({ isDeleted: false, isReported: false })
      .populate('author', 'fullName username avatar role followers following')
      .sort({ viewCount: -1, likeCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Khampha.countDocuments({ isDeleted: false, isReported: false });

    res.json({
      success: true,
      data: videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy video trending',
      error: error.message,
    });
  }
};

// Get a single video by ID
const getVideoById = async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await Khampha.findOne({ _id: videoId, isDeleted: false })
      .populate('author', 'fullName username avatar role followers following')
      .populate('mentions', 'fullName username avatar')
      .populate('likes', 'fullName username avatar')
      .populate('favorites', 'fullName username avatar');

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video',
      });
    }

    // Increment view count
    video.viewCount += 1;
    await video.save();

    res.json({
      success: true,
      data: video,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy video',
      error: error.message,
    });
  }
};

// Get videos by author
const getVideosByAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const videos = await Khampha.find({ author: authorId, isDeleted: false })
      .populate('author', 'fullName username avatar role followers following')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Khampha.countDocuments({ author: authorId, isDeleted: false });

    res.json({
      success: true,
      data: videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy video của người dùng',
      error: error.message,
    });
  }
};

// Update a video
const updateVideo = async (req, res) => {
  try {
    const userId = req.userId;
    const { videoId } = req.params;
    const {
      caption,
      music,
      hashtags,
      mentions,
      location,
      allowComments,
      allowDuet,
      allowStitch
    } = req.body;

    const video = await Khampha.findOne({ _id: videoId, isDeleted: false });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video',
      });
    }

    // Check if user is the author
    if (video.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền sửa video này',
      });
    }

    video.caption = caption !== undefined ? caption : video.caption;
    video.music = music !== undefined ? music : video.music;
    video.hashtags = hashtags !== undefined ? hashtags : video.hashtags;
    video.mentions = mentions !== undefined ? mentions : video.mentions;
    video.location = location !== undefined ? location : video.location;
    video.allowComments = allowComments !== undefined ? allowComments : video.allowComments;
    video.allowDuet = allowDuet !== undefined ? allowDuet : video.allowDuet;
    video.allowStitch = allowStitch !== undefined ? allowStitch : video.allowStitch;

    await video.save();

    await video.populate('author', 'fullName username avatar role followers following');

    res.json({
      success: true,
      message: 'Cập nhật video thành công',
      data: video,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật video',
      error: error.message,
    });
  }
};

// Delete a video (soft delete by user)
const deleteVideo = async (req, res) => {
  try {
    const userId = req.userId;
    const { videoId } = req.params;
    const io = req.app.get('io');

    const video = await Khampha.findOne({ _id: videoId, isDeleted: false });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video',
      });
    }

    // Check if user is the author
    if (video.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa video này',
      });
    }

    video.isDeleted = true;
    video.deletedAt = new Date();
    video.deletedBy = userId;

    await video.save();

    // Emit socket event
    emitSocketEvent(io, 'khampha:video-deleted', {
      videoId,
    });

    res.json({
      success: true,
      message: 'Xóa video thành công',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa video',
      error: error.message,
    });
  }
};

// Like/Unlike a video
const toggleLikeVideo = async (req, res) => {
  try {
    const userId = req.userId;
    const { videoId } = req.params;
    const io = req.app.get('io');

    const video = await Khampha.findOne({ _id: videoId, isDeleted: false });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video',
      });
    }

    const likeIndex = video.likes.indexOf(userId);
    const wasLiked = likeIndex > -1;

    if (wasLiked) {
      // Unlike
      video.likes.splice(likeIndex, 1);
      video.likeCount = Math.max(0, video.likeCount - 1);
    } else {
      // Like
      video.likes.push(userId);
      video.likeCount += 1;

      // Tạo notification cho chủ video (nếu không phải chính mình)
      if (video.author.toString() !== userId) {
        try {
          await Notification.create({
            recipient: video.author,
            sender: userId,
            type: 'video_like',
            referenceId: videoId,
            message: 'đã thích video của bạn',
          });

          // Emit notification qua socket
          if (io) {
            io.to(video.author.toString()).emit('notification:new', {
              type: 'video_like',
              videoId,
              senderId: userId,
            });
          }
        } catch (notifError) {
          console.error('Error creating like notification:', notifError);
        }
      }
    }

    await video.save();

    // Emit socket event
    emitSocketEvent(io, 'khampha:video-liked', {
      videoId,
      likeCount: video.likeCount,
      userId,
      isLiked: !wasLiked,
    });

    res.json({
      success: true,
      message: likeIndex > -1 ? 'Đã bỏ thích' : 'Đã thích video',
      likeCount: video.likeCount,
      isLiked: likeIndex === -1,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi thích video',
      error: error.message,
    });
  }
};

// Favorite/Unfavorite a video
const toggleFavoriteVideo = async (req, res) => {
  try {
    const userId = req.userId;
    const { videoId } = req.params;
    const io = req.app.get('io');

    const video = await Khampha.findOne({ _id: videoId, isDeleted: false });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video',
      });
    }

    const favoriteIndex = video.favorites.indexOf(userId);
    const wasFavorited = favoriteIndex > -1;

    if (wasFavorited) {
      // Unfavorite
      video.favorites.splice(favoriteIndex, 1);
      video.favoriteCount = Math.max(0, video.favoriteCount - 1);
    } else {
      // Favorite
      video.favorites.push(userId);
      video.favoriteCount += 1;

      // Tạo notification cho chủ video (nếu không phải chính mình)
      if (video.author.toString() !== userId) {
        try {
          await Notification.create({
            recipient: video.author,
            sender: userId,
            type: 'video_favorite',
            referenceId: videoId,
            message: 'đã lưu video của bạn vào yêu thích',
          });

          // Emit notification qua socket
          if (io) {
            io.to(video.author.toString()).emit('notification:new', {
              type: 'video_favorite',
              videoId,
              senderId: userId,
            });
          }
        } catch (notifError) {
          console.error('Error creating favorite notification:', notifError);
        }
      }
    }

    await video.save();

    // Emit socket event
    emitSocketEvent(io, 'khampha:video-favorited', {
      videoId,
      favoriteCount: video.favoriteCount,
      userId,
      isFavorited: !wasFavorited,
    });

    res.json({
      success: true,
      message: favoriteIndex > -1 ? 'Đã bỏ yêu thích' : 'Đã thêm vào yêu thích',
      favoriteCount: video.favoriteCount,
      isFavorited: favoriteIndex === -1,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi yêu thích video',
      error: error.message,
    });
  }
};

// Share a video
const shareVideo = async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await Khampha.findOne({ _id: videoId, isDeleted: false });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video',
      });
    }

    video.shareCount += 1;
    await video.save();

    res.json({
      success: true,
      message: 'Chia sẻ video thành công',
      shareCount: video.shareCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi chia sẻ video',
      error: error.message,
    });
  }
};

// Admin: Delete video (for violation)
const adminDeleteVideo = async (req, res) => {
  try {
    const userId = req.userId;
    const { videoId } = req.params;
    const { reason } = req.body;
    const io = req.app.get('io');

    const video = await Khampha.findOne({ _id: videoId, isDeleted: false });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video',
      });
    }

    video.isDeleted = true;
    video.deletedAt = new Date();
    video.deletedBy = userId;
    video.deleteReason = reason || 'Vi phạm nội dung';

    await video.save();

    // Emit socket event
    emitSocketEvent(io, 'khampha:video-admin-deleted', {
      videoId,
      reason,
    });

    res.json({
      success: true,
      message: 'Đã xóa video vi phạm',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa video',
      error: error.message,
    });
  }
};

// Admin: Get all videos (including reported/deleted)
const adminGetAllVideos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    let filter = {};
    if (status === 'reported') {
      filter = { isReported: true, isDeleted: false };
    } else if (status === 'deleted') {
      filter = { isDeleted: true };
    } else {
      filter = {};
    }

    const videos = await Khampha.find(filter)
      .populate('author', 'fullName username avatar role')
      .populate('deletedBy', 'fullName username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Khampha.countDocuments(filter);

    res.json({
      success: true,
      data: videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách video',
      error: error.message,
    });
  }
};

// Admin: Report a video
const adminReportVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const io = req.app.get('io');

    const video = await Khampha.findOne({ _id: videoId, isDeleted: false });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video',
      });
    }

    video.isReported = true;
    await video.save();

    // Emit socket event
    emitSocketEvent(io, 'khampha:video-reported', {
      videoId,
    });

    res.json({
      success: true,
      message: 'Đã báo cáo video',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi báo cáo video',
      error: error.message,
    });
  }
};

module.exports = {
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
};
