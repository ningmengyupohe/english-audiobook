/**
 * 本地存储管理工具
 * 管理播放历史、收藏、下载等本地数据
 */

const STORAGE_KEYS = {
    PLAY_HISTORY: 'play_history',
    FAVORITE_BOOKS: 'favorite_books',
    DOWNLOADED_BOOKS: 'downloaded_books',
    STUDY_RECORDS: 'study_records',
    STUDY_STATISTICS: 'study_statistics',
    USER_SETTINGS: 'user_settings'
  };
  
  class StorageManager {
    // ============ 播放历史管理 ============
    
    // 获取播放历史
    static getPlayHistory() {
      try {
        const history = wx.getStorageSync(STORAGE_KEYS.PLAY_HISTORY);
        if (!history) {
          return this.initPlayHistory();
        }
        return history;
      } catch (error) {
        console.error('获取播放历史失败:', error);
        return this.initPlayHistory();
      }
    }
    
    // 初始化播放历史
    static initPlayHistory() {
      const defaultHistory = {
        currentPlay: null,
        recentPlays: [],
        statistics: {
          totalListenTime: 0,
          totalBooks: 0,
          totalChapters: 0,
          lastPlayTime: null
        }
      };
      wx.setStorageSync(STORAGE_KEYS.PLAY_HISTORY, defaultHistory);
      return defaultHistory;
    }
    
    // 更新当前播放
    static updateCurrentPlay(bookId, chapterId, progress = 0, duration = 0) {
      try {
        const history = this.getPlayHistory();
        
        const currentPlay = {
          bookId,
          chapterId,
          progress,
          duration,
          playTime: Date.now()
        };
        
        history.currentPlay = currentPlay;
        
        // 添加到最近播放
        const existingIndex = history.recentPlays.findIndex(
          item => item.bookId === bookId && item.chapterId === chapterId
        );
        
        if (existingIndex !== -1) {
          history.recentPlays.splice(existingIndex, 1);
        }
        
        history.recentPlays.unshift(currentPlay);
        
        // 限制数量
        if (history.recentPlays.length > 50) {
          history.recentPlays = history.recentPlays.slice(0, 50);
        }
        
        // 更新统计
        history.statistics.lastPlayTime = Date.now();
        history.statistics.totalBooks = new Set(history.recentPlays.map(p => p.bookId)).size;
        
        wx.setStorageSync(STORAGE_KEYS.PLAY_HISTORY, history);
        return history;
      } catch (error) {
        console.error('更新当前播放失败:', error);
        return null;
      }
    }
    
    // 清除播放历史
    static clearPlayHistory() {
      wx.removeStorageSync(STORAGE_KEYS.PLAY_HISTORY);
      return true;
    }
    
    // ============ 收藏管理 ============
    
    // 获取收藏列表
    static getFavorites() {
      try {
        return wx.getStorageSync(STORAGE_KEYS.FAVORITE_BOOKS) || [];
      } catch (error) {
        console.error('获取收藏列表失败:', error);
        return [];
      }
    }
    
    // 添加到收藏
    static addFavorite(bookId) {
      try {
        let favorites = this.getFavorites();
        if (!favorites.includes(bookId)) {
          favorites.push(bookId);
          wx.setStorageSync(STORAGE_KEYS.FAVORITE_BOOKS, favorites);
        }
        return favorites;
      } catch (error) {
        console.error('添加到收藏失败:', error);
        return this.getFavorites();
      }
    }
    
    // 从收藏移除
    static removeFavorite(bookId) {
      try {
        let favorites = this.getFavorites();
        favorites = favorites.filter(id => id !== bookId);
        wx.setStorageSync(STORAGE_KEYS.FAVORITE_BOOKS, favorites);
        return favorites;
      } catch (error) {
        console.error('从收藏移除失败:', error);
        return this.getFavorites();
      }
    }
    
    // 检查是否收藏
    static isFavorite(bookId) {
      return this.getFavorites().includes(bookId);
    }
    
    // ============ 下载管理 ============
    
    // 获取下载列表
    static getDownloads() {
      try {
        return wx.getStorageSync(STORAGE_KEYS.DOWNLOADED_BOOKS) || [];
      } catch (error) {
        console.error('获取下载列表失败:', error);
        return [];
      }
    }
    
    // 添加到下载
    static addDownload(bookId) {
      try {
        let downloads = this.getDownloads();
        if (!downloads.includes(bookId)) {
          downloads.push(bookId);
          wx.setStorageSync(STORAGE_KEYS.DOWNLOADED_BOOKS, downloads);
        }
        return downloads;
      } catch (error) {
        console.error('添加到下载失败:', error);
        return this.getDownloads();
      }
    }
    
    // 移除下载
    static removeDownload(bookId) {
      try {
        let downloads = this.getDownloads();
        downloads = downloads.filter(id => id !== bookId);
        wx.setStorageSync(STORAGE_KEYS.DOWNLOADED_BOOKS, downloads);
        return downloads;
      } catch (error) {
        console.error('移除下载失败:', error);
        return this.getDownloads();
      }
    }
    
    // 检查是否已下载
    static isDownloaded(bookId) {
      return this.getDownloads().includes(bookId);
    }
    
    // ============ 学习记录管理 ============
    
    // 添加学习记录
    static addStudyRecord(record) {
      try {
        let records = wx.getStorageSync(STORAGE_KEYS.STUDY_RECORDS) || [];
        records.push(record);
        
        // 限制记录数量
        if (records.length > 100) {
          records = records.slice(-100);
        }
        
        wx.setStorageSync(STORAGE_KEYS.STUDY_RECORDS, records);
        return records;
      } catch (error) {
        console.error('添加学习记录失败:', error);
        return [];
      }
    }
    
    // 获取学习记录
    static getStudyRecords(limit = 20) {
      try {
        const records = wx.getStorageSync(STORAGE_KEYS.STUDY_RECORDS) || [];
        return records.slice(-limit).reverse();
      } catch (error) {
        console.error('获取学习记录失败:', error);
        return [];
      }
    }
    
    // ============ 学习统计管理 ============
    
    // 获取学习统计
    static getStudyStatistics() {
      try {
        const stats = wx.getStorageSync(STORAGE_KEYS.STUDY_STATISTICS);
        if (!stats) {
          return this.initStudyStatistics();
        }
        return stats;
      } catch (error) {
        console.error('获取学习统计失败:', error);
        return this.initStudyStatistics();
      }
    }
    
    // 初始化学习统计
    static initStudyStatistics() {
      const defaultStats = {
        totalMinutes: 0,
        totalBooks: 0,
        totalChapters: 0,
        lastStudyTime: null,
        streaks: {
          currentStreak: 0,
          longestStreak: 0,
          lastStudyDate: null
        }
      };
      wx.setStorageSync(STORAGE_KEYS.STUDY_STATISTICS, defaultStats);
      return defaultStats;
    }
    
    // 更新学习统计
    static updateStudyStatistics(minutes, chapters) {
      try {
        const stats = this.getStudyStatistics();
        
        stats.totalMinutes += minutes;
        stats.totalChapters += chapters;
        stats.lastStudyTime = Date.now();
        
        // 更新连续学习天数
        this.updateStudyStreak(stats);
        
        wx.setStorageSync(STORAGE_KEYS.STUDY_STATISTICS, stats);
        return stats;
      } catch (error) {
        console.error('更新学习统计失败:', error);
        return this.getStudyStatistics();
      }
    }
    
    // 更新学习连续天数
    static updateStudyStreak(stats) {
      const now = new Date();
      const today = now.toDateString();
      
      if (!stats.streaks) {
        stats.streaks = {
          currentStreak: 0,
          longestStreak: 0,
          lastStudyDate: null
        };
      }
      
      if (stats.streaks.lastStudyDate) {
        const lastDate = new Date(stats.streaks.lastStudyDate).toDateString();
        const yesterday = new Date(now.setDate(now.getDate() - 1)).toDateString();
        
        if (lastDate === today) {
          // 今天已经学习过
          return;
        } else if (lastDate === yesterday) {
          // 昨天学习过，连续天数+1
          stats.streaks.currentStreak += 1;
        } else {
          // 中断了，重置连续天数
          stats.streaks.currentStreak = 1;
        }
      } else {
        // 第一次学习
        stats.streaks.currentStreak = 1;
      }
      
      // 更新最长连续天数
      if (stats.streaks.currentStreak > stats.streaks.longestStreak) {
        stats.streaks.longestStreak = stats.streaks.currentStreak;
      }
      
      stats.streaks.lastStudyDate = Date.now();
    }
    
    // ============ 用户设置管理 ============
    
    // 获取用户设置
    static getUserSettings() {
      try {
        const settings = wx.getStorageSync(STORAGE_KEYS.USER_SETTINGS);
        if (!settings) {
          return this.initUserSettings();
        }
        return settings;
      } catch (error) {
        console.error('获取用户设置失败:', error);
        return this.initUserSettings();
      }
    }
    
    // 初始化用户设置
    static initUserSettings() {
      const defaultSettings = {
        playbackSpeed: 1.0,
        volume: 0.8,
        playMode: 'order', // order, loop, random
        autoPlay: true,
        backgroundPlay: true,
        downloadOnWifi: true,
        notifications: {
          studyReminder: true,
          newContent: true
        }
      };
      wx.setStorageSync(STORAGE_KEYS.USER_SETTINGS, defaultSettings);
      return defaultSettings;
    }
    
    // 更新用户设置
    static updateUserSettings(newSettings) {
      try {
        const settings = this.getUserSettings();
        const updated = { ...settings, ...newSettings };
        wx.setStorageSync(STORAGE_KEYS.USER_SETTINGS, updated);
        return updated;
      } catch (error) {
        console.error('更新用户设置失败:', error);
        return this.getUserSettings();
      }
    }
    
    // ============ 导出数据 ============
    
    // 导出所有数据
    static exportAllData() {
      try {
        const data = {};
        Object.keys(STORAGE_KEYS).forEach(key => {
          data[STORAGE_KEYS[key]] = wx.getStorageSync(STORAGE_KEYS[key]);
        });
        return data;
      } catch (error) {
        console.error('导出数据失败:', error);
        return null;
      }
    }
    
    // 导入数据
    static importData(data) {
      try {
        Object.keys(data).forEach(key => {
          if (Object.values(STORAGE_KEYS).includes(key)) {
            wx.setStorageSync(key, data[key]);
          }
        });
        return true;
      } catch (error) {
        console.error('导入数据失败:', error);
        return false;
      }
    }
    
    // 清除所有数据
    static clearAllData() {
      try {
        Object.values(STORAGE_KEYS).forEach(key => {
          wx.removeStorageSync(key);
        });
        return true;
      } catch (error) {
        console.error('清除所有数据失败:', error);
        return false;
      }
    }
  }
  
  module.exports = StorageManager;