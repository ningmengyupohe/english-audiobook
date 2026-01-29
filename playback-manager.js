// utils/playback-manager.js
class PlaybackManager {
  // 获取当前播放
  static getCurrentPlay() {
    return wx.getStorageSync('current_play') || null;
  }

  // 设置当前播放
  static setCurrentPlay(data) {
    wx.setStorageSync('current_play', data);
  }

  // 保存播放进度
  static savePlayProgress(data) {
    const history = this.getPlayHistory();
    const index = history.findIndex(item => 
      item.bookId === data.bookId && item.chapterId === data.chapterId
    );
    
    if (index !== -1) {
      history[index] = { ...history[index], ...data };
    } else {
      history.unshift(data);
    }
    
    wx.setStorageSync('play_history', history.slice(0, 100));
  }

  // 获取播放历史
  static getPlayHistory() {
    return wx.getStorageSync('play_history') || [];
  }

  // 记录完成
  static recordComplete(data) {
    const completed = wx.getStorageSync('completed_chapters') || [];
    const key = `${data.bookId}_${data.chapterId}`;
    
    if (!completed.includes(key)) {
      completed.push(key);
      wx.setStorageSync('completed_chapters', completed);
    }
  }
}

module.exports = PlaybackManager;