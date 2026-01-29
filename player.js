// player.js - 完全修复版本
// 使用正确的UniCloud API调用方式

const { cloudAPI } = require('../../utils/uni-cloud.js');
const playbackManager = require('../../utils/playback-manager.js');

Page({
  data: {
    // 播放器状态
    audioContext: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isBuffering: false,
    playbackRate: 1.0,
    volume: 80,
    
    // 播放内容
    currentBook: null,
    currentChapter: null,
    chapters: [],
    chapterIndex: 0,
    
    // 用户界面
    showPlaylist: false,
    showSubtitle: false,
    showControls: true,
    showError: false,
    errorMessage: '',
    isLoading: false,
    
    // 用户状态
    isLoggedIn: false,
    userInfo: null,
    
    // 播放模式
    playMode: 'sequential', // sequential, repeat_one, shuffle
    
    // 字幕相关
    subtitle: [],
    currentSubtitleIndex: -1,
    
    // 定时器
    autoHideTimer: null,
    progressTimer: null
  },

  onLoad: function(options) {
    console.log('🎵 播放器加载，参数:', options);
    
    // 初始化音频上下文
    this.initAudioContext();
    
    // 检查登录状态
    this.checkLoginStatus();
    
    // 加载播放内容
    if (options && options.bookId) {
      this.initPlayContent(options);
    } else {
      // 如果没有传入参数，尝试继续上次播放
      this.loadContinuePlay();
    }
  },

  onShow: function() {
    console.log('🎵 播放器显示');
    
    // 恢复播放器状态
    if (this.data.audioContext && this.data.isPlaying) {
      this.data.audioContext.play();
    }
    
    // 检查登录状态
    this.checkLoginStatus();
  },

  onHide: function() {
    console.log('🎵 播放器隐藏');
    
    // 保存播放进度
    this.savePlayProgress();
    
    // 暂停播放
    if (this.data.audioContext && this.data.isPlaying) {
      this.data.audioContext.pause();
    }
    
    // 清除定时器
    this.clearTimers();
  },

  onUnload: function() {
    console.log('🎵 播放器卸载');
    
    // 保存播放进度
    this.savePlayProgress();
    
    // 销毁音频上下文
    this.destroyAudioContext();
    
    // 清除定时器
    this.clearTimers();
  },

  // ==================== 初始化函数 ====================

  /**
   * 初始化音频上下文
   */
  initAudioContext: function() {
    try {
      const audioContext = wx.createInnerAudioContext();
      
      // 配置音频
      audioContext.autoplay = false;
      audioContext.loop = false;
      audioContext.obeyMuteSwitch = false;
      audioContext.playbackRate = this.data.playbackRate;
      audioContext.volume = this.data.volume / 100;
      
      // 绑定事件
      audioContext.onCanplay(() => {
        console.log('✅ 音频可以播放');
        this.setData({ 
          isBuffering: false,
          duration: audioContext.duration || 0
        });
      });
      
      audioContext.onPlay(() => {
        console.log('▶️ 音频开始播放');
        this.setData({ 
          isPlaying: true,
          isBuffering: false 
        });
        
        // 开始进度更新定时器
        this.startProgressTimer();
        
        // 更新当前播放记录
        this.updateCurrentPlayRecord();
      });
      
      audioContext.onPause(() => {
        console.log('⏸️ 音频暂停');
        this.setData({ isPlaying: false });
        this.stopProgressTimer();
      });
      
      audioContext.onStop(() => {
        console.log('⏹️ 音频停止');
        this.setData({ isPlaying: false });
        this.stopProgressTimer();
      });
      
      audioContext.onEnded(() => {
        console.log('🎉 音频播放结束');
        this.setData({ isPlaying: false });
        this.stopProgressTimer();
        this.handlePlayEnded();
      });
      
      audioContext.onError((err) => {
        console.error('❌ 音频播放错误:', err);
        this.handleAudioError(err);
      });
      
      audioContext.onWaiting(() => {
        console.log('⏳ 音频缓冲中...');
        this.setData({ isBuffering: true });
      });
      
      audioContext.onSeeking(() => {
        console.log('🎯 音频跳转中...');
      });
      
      audioContext.onSeeked(() => {
        console.log('✅ 音频跳转完成');
        this.updateSubtitlePosition();
      });
      
      audioContext.onTimeUpdate(() => {
        this.updateSubtitlePosition();
      });
      
      this.setData({ audioContext });
      console.log('✅ 音频上下文初始化完成');
      
    } catch (error) {
      console.error('❌ 初始化音频上下文失败:', error);
      this.setData({
        showError: true,
        errorMessage: '播放器初始化失败: ' + error.message
      });
    }
  },

  /**
   * 销毁音频上下文
   */
  destroyAudioContext: function() {
    if (this.data.audioContext) {
      this.data.audioContext.destroy();
      this.setData({ audioContext: null });
      console.log('✅ 音频上下文已销毁');
    }
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus: function() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      const token = wx.getStorageSync('token');
      
      if (userInfo && token) {
        console.log('🔐 用户已登录:', userInfo.nickname || userInfo.username);
        this.setData({
          isLoggedIn: true,
          userInfo: userInfo
        });
      } else {
        console.log('🔐 用户未登录');
        this.setData({
          isLoggedIn: false,
          userInfo: null
        });
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    }
  },

  /**
   * 初始化播放内容
   */
  initPlayContent: function(options) {
    console.log('🎵 初始化播放内容:', options);
    
    const { bookId, chapterId, chapterIndex, restoreProgress = 0 } = options;
    
    // 重置状态
    this.setData({
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      showError: false,
      errorMessage: '',
      isLoading: true
    });
    
    // 停止当前播放
    if (this.data.audioContext) {
      this.data.audioContext.stop();
    }
    
    // 加载书籍和章节
    this.loadBookAndChapter({
      bookId: bookId,
      chapterId: chapterId,
      chapterIndex: chapterIndex || 0,
      restoreProgress: restoreProgress
    });
  },

  /**
   * 加载继续播放
   */
  loadContinuePlay: function() {
    console.log('🔄 加载继续播放...');
    
    // 先检查本地存储
    const localPlay = playbackManager.getCurrentPlay();
    if (localPlay && localPlay.bookId) {
      console.log('📱 从本地恢复播放:', localPlay);
      this.initPlayContent({
        bookId: localPlay.bookId,
        chapterId: localPlay.chapterId,
        restoreProgress: localPlay.progress || 0
      });
    } else if (this.data.isLoggedIn) {
      // 从云端获取
      this.loadContinuePlayFromCloud();
    } else {
      this.showNoContentGuide();
    }
  },

  /**
   * 从云端加载继续播放
   */
  loadContinuePlayFromCloud: function() {
    console.log('☁️ 从云端加载继续播放...');
    
    wx.showLoading({ title: '加载中...' });
    
    cloudAPI.player.getContinuePlay()
      .then(data => {
        wx.hideLoading();
        console.log('✅ 云端继续播放数据:', data);
        
        if (data && data.bookId) {
          this.initPlayContent({
            bookId: data.bookId,
            chapterId: data.chapterId,
            restoreProgress: data.progress || 0
          });
        } else {
          this.showNoContentGuide();
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('❌ 获取云端播放记录失败:', err);
        
        // 回退到本地
        const localPlay = playbackManager.getCurrentPlay();
        if (localPlay && localPlay.bookId) {
          this.initPlayContent({
            bookId: localPlay.bookId,
            chapterId: localPlay.chapterId,
            restoreProgress: localPlay.progress || 0
          });
        } else {
          this.showNoContentGuide();
        }
      });
  },

  // ==================== 数据加载函数 ====================

/**
 * 加载书籍和章节（完整修复版）
 */
loadBookAndChapter: async function(params) {
    console.log('📚 加载书籍和章节:', params);
    
    const { bookId, chapterId, chapterIndex, restoreProgress } = params;
    
    wx.showLoading({ title: '加载中...' });
    
    try {
      // 1. 加载书籍信息（混合模式）
      const bookInfo = await this.loadBookInfo(bookId);
      
      // 2. 加载章节列表（云端优先，本地备用）
      const chapters = await this.loadChapterListFromCloud(bookId);
      
      if (chapters.length === 0) {
        throw new Error('该书籍没有可播放的章节');
      }
      
      // 3. 确定要播放的章节
      let targetChapter = null;
      let targetChapterIndex = 0;
      
      if (chapterId) {
        // 通过chapterId查找
        targetChapter = chapters.find(chap => 
          chap._id === chapterId || 
          chap.chapterId === chapterId || 
          chap.id === chapterId
        );
        if (targetChapter) {
          targetChapterIndex = chapters.findIndex(chap => 
            chap._id === targetChapter._id
          );
        }
      } else if (chapterIndex !== undefined) {
        // 通过索引查找
        targetChapterIndex = Math.max(0, Math.min(chapterIndex, chapters.length - 1));
        targetChapter = chapters[targetChapterIndex];
      }
      
      // 如果没找到指定章节，使用第一章
      if (!targetChapter) {
        console.log('⚠️ 未找到指定章节，播放第一章');
        targetChapter = chapters[0];
        targetChapterIndex = 0;
      }
      
      // 4. 加载章节详情（混合模式）
      const chapterDetail = await this.loadChapterDetail(targetChapter._id);
      
      // 5. 更新UI状态
      this.setData({
        currentBook: bookInfo,
        currentChapter: chapterDetail,
        chapters: chapters,
        chapterIndex: targetChapterIndex,
        isLoading: false,
        showError: false,
        errorMessage: ''
      });
      
      // 6. 设置音频源（修复音频路径）
      await this.setAudioSource(chapterDetail);
      
      // 7. 恢复播放进度
      if (restoreProgress > 0 && restoreProgress < (chapterDetail.duration || 0)) {
        setTimeout(() => {
          this.seekTo(restoreProgress);
        }, 500);
      }
      
      // 8. 更新当前播放记录
      this.updateCurrentPlayRecord();
      
      wx.hideLoading();
      console.log('✅ 播放器初始化完成');
      
    } catch (error) {
      wx.hideLoading();
      console.error('❌ 加载书籍和章节失败:', error);
      
      this.setData({
        showError: true,
        errorMessage: error.message || '加载失败，请重试',
        isLoading: false
      });
      
      wx.showToast({
        title: '加载失败',
        icon: 'error',
        duration: 2000
      });
    }
  },

  /**
   * 从UniCloud加载书籍信息
   */
  loadBookInfoFromCloud: function(bookId) {
    console.log('📚 从UniCloud加载书籍信息:', bookId);
    
    return new Promise((resolve, reject) => {
      cloudAPI.book.getDetail(bookId)
        .then(response => {
          console.log('✅ 书籍信息响应:', response);
          
          let bookInfo = null;
          
          // 处理不同的响应格式
          if (response && response.code === 0 && response.data) {
            bookInfo = response.data;
          } else if (response && (response._id || response.id)) {
            bookInfo = response;
          } else if (response && response.data && (response.data._id || response.data.id)) {
            bookInfo = response.data;
          }
          
          if (!bookInfo) {
            throw new Error('书籍数据格式错误');
          }
          
          console.log('📊 提取到的书籍信息:', {
            id: bookInfo._id || bookInfo.id,
            title: bookInfo.title,
            cover: bookInfo.cover || bookInfo.image
          });
          
          resolve(bookInfo);
        })
        .catch(err => {
          console.error('❌ 加载书籍信息失败:', err);
          
          // 使用备用信息
          const fallbackBook = this.getFallbackBookInfo(bookId);
          if (fallbackBook) {
            console.log('🔄 使用备用书籍信息');
            resolve(fallbackBook);
          } else {
            reject(new Error('无法加载书籍信息: ' + (err.message || '未知错误')));
          }
        });
    });
  },
  /**
 * 加载章节详情（主要函数 - 调用 loadChapterDetailFromCloud）
 */
loadChapterDetail: function(chapterId) {
    console.log('🔍 加载章节详情（主要函数）:', chapterId);
    
    // 🚨 调用现有的 loadChapterDetailFromCloud 函数
    return this.loadChapterDetailFromCloud(chapterId);
  },
  /**
 * 🚨 解析章节详情响应（处理多种格式）
 */
parseChapterDetailResponse: function(response) {
    console.log('🔍 解析章节详情响应:', response);
    
    if (!response) {
      console.log('⚠️ 章节详情响应为空');
      return null;
    }
    
    let chapterDetail = null;
    
    // 🚨 格式1：标准响应格式 {code: 0, data: {...}}
    if (response.code === 0 && response.data) {
      chapterDetail = response.data;
      console.log('📊 格式1: 标准响应格式');
    }
    // 🚨 格式2：直接是对象 {...}
    else if (response._id || response.id || response.chapterId) {
      chapterDetail = response;
      console.log('📊 格式2: 直接对象格式');
    }
    // 🚨 格式3：嵌套在data字段中
    else if (response.data && (response.data._id || response.data.id)) {
      chapterDetail = response.data;
      console.log('📊 格式3: 嵌套data字段');
    }
    // 🚨 格式4：可能在其他字段中
    else {
      // 尝试查找包含章节数据的字段
      for (const key in response) {
        if (response[key] && (response[key]._id || response[key].id)) {
          chapterDetail = response[key];
          console.log(`📊 格式4: 在"${key}"字段中找到`);
          break;
        }
      }
    }
    
    if (chapterDetail) {
      console.log('✅ 解析到的章节详情:', {
        id: chapterDetail._id || chapterDetail.id,
        title: chapterDetail.title,
        audioUrl: chapterDetail.audioUrl,
        duration: chapterDetail.duration
      });
    } else {
      console.log('❌ 无法解析章节详情响应');
    }
    
    return chapterDetail;
  },
  /**
 * 🚨 尝试使用封装API获取章节详情
 */
tryCloudAPIChapterDetail: function(chapterId) {
    console.log('🔍 尝试使用封装API获取章节详情:', chapterId);
    
    return new Promise((resolve, reject) => {
      cloudAPI.chapter.getDetail(chapterId)
        .then(response => {
          console.log('✅ 封装API章节详情响应:', response);
          
          const chapterDetail = this.parseChapterDetailResponse(response);
          if (chapterDetail) {
            resolve(chapterDetail);
          } else {
            reject(new Error('封装API返回无效数据'));
          }
        })
        .catch(err => {
          console.error('❌ 封装API章节详情调用失败:', err);
          reject(err);
        });
    });
  },

/**
 * 加载书籍信息（云端优先，本地备用）
 */
loadBookInfo: function(bookId) {
    console.log('📚 加载书籍信息:', bookId);
    
    return new Promise((resolve, reject) => {
      // 🚨 第一步：先尝试从云端加载
      this.tryLoadBookFromCloud(bookId)
        .then(cloudBook => {
          if (cloudBook) {
            console.log('✅ 云端书籍信息成功');
            resolve(cloudBook);
          } else {
            // 🚨 第二步：云端无数据，使用本地
            console.log('🔄 云端无书籍信息，使用本地');
            resolve(this.getLocalBookInfo(bookId));
          }
        })
        .catch(cloudErr => {
          console.error('❌ 云端书籍信息失败:', cloudErr.message);
          
          // 🚨 第三步：云端失败，使用本地
          console.log('🔄 云端失败，使用本地备用书籍信息');
          resolve(this.getLocalBookInfo(bookId));
        });
    });
  },
  
  /**
   * 尝试从云端加载书籍信息
   */
  tryLoadBookFromCloud: function(bookId) {
    console.log('🔍 尝试从云端加载书籍信息:', bookId);
    
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      
      // 🚨 设置超时时间（2秒）
      const timeoutPromise = new Promise((_, timeoutReject) => {
        setTimeout(() => {
          timeoutReject(new Error('书籍信息请求超时'));
        }, 2000);
      });
      
      // 🚨 实际请求
      const requestPromise = new Promise((requestResolve, requestReject) => {
        wx.request({
          url: 'https://fc-mp-22bc083a-75be-471b-a448-e1e547b31823.next.bspapp.com/api/book',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          data: JSON.stringify({
            action: 'getBookDetail',
            id: bookId,
            _timestamp: Date.now(),
            _platform: 'miniprogram'
          }),
          success: (res) => {
            console.log('🌐 书籍信息云端响应:', res.statusCode);
            
            if (res.statusCode === 200) {
              const bookInfo = this.parseBookResponse(res.data);
              requestResolve(bookInfo);
            } else {
              // 400错误时返回空，触发本地回退
              requestResolve(null);
            }
          },
          fail: (err) => {
            requestResolve(null); // 失败时返回null，触发本地回退
          }
        });
      });
      
      // 🚨 竞态：请求 vs 超时
      Promise.race([requestPromise, timeoutPromise])
        .then(resolve)
        .catch(() => {
          resolve(null); // 超时也返回null，触发本地回退
        });
    });
  },
  
  /**
   * 解析书籍信息响应
   */
  parseBookResponse: function(response) {
    console.log('🔍 解析书籍信息响应:', response);
    
    if (!response) return null;
    
    let bookInfo = null;
    
    // 🚨 格式1：标准响应格式 {code: 0, data: {...}}
    if (response.code === 0 && response.data) {
      bookInfo = response.data;
    }
    // 🚨 格式2：直接是对象 {...}
    else if (response._id || response.id) {
      bookInfo = response;
    }
    // 🚨 格式3：嵌套在data字段中
    else if (response.data && (response.data._id || response.data.id)) {
      bookInfo = response.data;
    }
    
    if (bookInfo) {
      console.log('✅ 解析到的书籍信息:', {
        id: bookInfo._id || bookInfo.id,
        title: bookInfo.title,
        cover: bookInfo.cover
      });
    }
    
    return bookInfo;
  },
  
  /**
   * 获取本地书籍信息（备用）
   */
  getLocalBookInfo: function(bookId) {
    console.log('📱 获取本地书籍信息，bookId:', bookId);
    
    // 🚨 本地书籍数据
    const localBooks = {
      '101': {
        _id: '101',
        title: '英语学习入门',
        cover: '/images/covers/default.jpg',
        author: '系统推荐',
        description: '适合初学者的英语学习材料',
        totalChapters: 3,
        totalDuration: 878,
        category: '英语学习',
        difficulty: '初级'
      },
      '102': {
        _id: '102',
        title: '商务英语',
        cover: '/images/covers/default.jpg',
        author: '商务英语团队',
        description: '提升职场英语能力',
        totalChapters: 2,
        totalDuration: 650,
        category: '商务英语',
        difficulty: '中级'
      }
    };
    
    const bookInfo = localBooks[bookId] || {
      _id: bookId,
      title: `书籍 ${bookId}`,
      cover: '/images/covers/default.jpg',
      author: '未知作者',
      description: '暂无描述',
      totalChapters: 0,
      totalDuration: 0
    };
    
    console.log('📊 本地书籍信息:', bookInfo.title);
    return bookInfo;
  },
/**
 * 从UniCloud加载章节列表（云端优先，本地备用）
 */
loadChapterListFromCloud: function(bookId) {
    console.log('📋 加载章节列表（云端优先）:', bookId);
    
    return new Promise((resolve, reject) => {
      // 🚨 第一步：先尝试从云端加载
      this.tryLoadFromCloud(bookId)
        .then(cloudChapters => {
          if (cloudChapters && cloudChapters.length > 0) {
            console.log('✅ 云端数据成功:', cloudChapters.length, '个章节');
            this.setData({ 
              useCloudData: true,
              lastCloudSyncTime: Date.now()
            });
            
            // 🚨 同时缓存到本地（为下次使用）
            this.cacheChaptersToLocal(bookId, cloudChapters);
            
            resolve(cloudChapters);
          } else {
            // 🚨 云端返回空数据，使用本地
            console.log('🔄 云端返回空数据，使用本地备用数据');
            const localChapters = this.getLocalChapters(bookId);
            if (localChapters.length > 0) {
              resolve(localChapters);
            } else {
              reject(new Error('云端和本地都没有章节数据'));
            }
          }
        })
        .catch(cloudErr => {
          console.error('❌ 云端加载失败:', cloudErr.message);
          
          // 🚨 第二步：云端失败后，使用本地数据
          const localChapters = this.getLocalChapters(bookId);
          if (localChapters.length > 0) {
            console.log('✅ 使用本地备用数据:', localChapters.length, '个章节');
            resolve(localChapters);
          } else {
            reject(new Error('无法加载章节列表: ' + cloudErr.message));
          }
        });
    });
  },
  
  /**
   * 🚨 尝试从云端加载章节列表
   */
  tryLoadFromCloud: function(bookId) {
    console.log('🔍 尝试从云端加载章节，bookId:', bookId);
    
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      
      // 🚨 设置超时时间（3秒）
      const timeoutPromise = new Promise((_, timeoutReject) => {
        setTimeout(() => {
          timeoutReject(new Error('云端请求超时'));
        }, 3000);
      });
      
      // 🚨 实际请求
      const requestPromise = new Promise((requestResolve, requestReject) => {
        wx.request({
          url: 'https://fc-mp-22bc083a-75be-471b-a448-e1e547b31823.next.bspapp.com/api/chapter',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          data: JSON.stringify({
            action: 'getChapterList',
            bookId: bookId,
            page: 1,
            pageSize: 100,
            _timestamp: Date.now(),
            _platform: 'miniprogram'
          }),
          success: (res) => {
            console.log('🌐 云端响应:', res.statusCode, res.data);
            
            if (res.statusCode === 200) {
              const chapters = this.parseCloudResponse(res.data);
              requestResolve(chapters);
            } else if (res.statusCode === 400 && res.data.message === '未知的操作类型') {
              // 🚨 特殊处理：如果云函数不支持这个action，记录日志但不抛出错误
              console.log('⚠️ 云函数不支持 getChapterList action，将使用本地数据');
              requestResolve([]); // 返回空数组，触发回退到本地
            } else {
              requestReject(new Error(`HTTP ${res.statusCode}: ${res.data?.message || '请求失败'}`));
            }
          },
          fail: (err) => {
            requestReject(err);
          }
        });
      });
      
      // 🚨 竞态：请求 vs 超时
      Promise.race([requestPromise, timeoutPromise])
        .then(resolve)
        .catch(reject);
    });
  },
  
  /**
   * 🚨 解析云端响应（处理多种格式）
   */
  parseCloudResponse: function(response) {
    console.log('🔍 解析云端响应:', response);
    
    if (!response) return [];
    
    let chapters = [];
    
    // 🚨 格式1：标准响应格式 {code: 0, data: {list: [...]}}
    if (response.code === 0 && response.data) {
      if (response.data.list && Array.isArray(response.data.list)) {
        chapters = response.data.list;
      } else if (Array.isArray(response.data)) {
        chapters = response.data;
      }
    }
    // 🚨 格式2：直接包含list字段 {list: [...]}
    else if (response.list && Array.isArray(response.list)) {
      chapters = response.list;
    }
    // 🚨 格式3：直接是数组 [...]
    else if (Array.isArray(response)) {
      chapters = response;
    }
    
    // 🚨 排序
    if (chapters.length > 0) {
      chapters = chapters.sort((a, b) => {
        return (a.sort || a.chapterNumber || 0) - (b.sort || b.chapterNumber || 0);
      });
    }
    
    console.log('📊 解析结果:', chapters.length, '个章节');
    return chapters;
  },
  
  /**
   * 🚨 获取本地章节列表（备用）
   */
  getLocalChapters: function(bookId) {
    console.log('📱 获取本地章节，bookId:', bookId);
    
    // 🚨 本地模拟数据
    const localChaptersData = {
      '101': [
        { 
          _id: 'C10101', 
          bookId: '101', 
          title: '第1课 英语学习', 
          sort: 1, 
          audioUrl: '/audio/101/chapter1.mp3', 
          duration: 273,
          fileSize: 39174626,
          isFree: 'True',
          wordCount: 682
        },
        { 
          _id: 'C10102', 
          bookId: '101', 
          title: '第2课 日常对话', 
          sort: 2, 
          audioUrl: '/audio/101/chapter2.mp3', 
          duration: 320,
          fileSize: 45000000,
          isFree: 'True',
          wordCount: 800
        },
        { 
          _id: 'C10103', 
          bookId: '101', 
          title: '第3课 旅行英语', 
          sort: 3, 
          audioUrl: '/audio/101/chapter3.mp3', 
          duration: 285,
          fileSize: 42000000,
          isFree: 'True',
          wordCount: 710
        }
      ]
    };
    
    const chapters = localChaptersData[bookId] || [];
    console.log('📊 本地章节数据:', chapters.length, '个章节');
    return chapters;
  },
  
  /**
   * 🚨 缓存章节数据到本地
   */
  cacheChaptersToLocal: function(bookId, chapters) {
    try {
      // 这里可以缓存到本地存储，下次优先使用
      const cacheKey = `chapters_cache_${bookId}`;
      const cacheData = {
        chapters: chapters,
        timestamp: Date.now(),
        bookId: bookId
      };
      wx.setStorageSync(cacheKey, cacheData);
      console.log('💾 章节数据已缓存到本地');
    } catch (err) {
      console.error('缓存章节数据失败:', err);
    }
  },
  
  /**
   * 🚨 从本地缓存加载章节
   */
  loadFromLocalCache: function(bookId) {
    try {
      const cacheKey = `chapters_cache_${bookId}`;
      const cacheData = wx.getStorageSync(cacheKey);
      
      if (cacheData && cacheData.chapters && cacheData.timestamp) {
        // 🚨 检查缓存是否过期（1小时）
        const isExpired = Date.now() - cacheData.timestamp > 3600000;
        if (!isExpired) {
          console.log('📦 从本地缓存加载:', cacheData.chapters.length, '个章节');
          return cacheData.chapters;
        }
      }
    } catch (err) {
      console.error('加载本地缓存失败:', err);
    }
    return [];
  },
  
  /**
   * 🚨 直接调试调用云函数
   */
  directDebugChapterService: function(bookId) {
    console.log('🔍 直接调试调用云函数，bookId:', bookId);
    
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      
      // 🚨 尝试多个可能的action
      const testActions = [
        { action: 'getChapterList', params: { bookId, page: 1, pageSize: 100 } },
        { action: 'getChapters', params: { bookId } },
        { action: 'list', params: { bookId } },
        { action: 'query', params: { bookId } }
      ];
      
      const tryAction = (index) => {
        if (index >= testActions.length) {
          reject(new Error('所有action尝试都失败'));
          return;
        }
        
        const test = testActions[index];
        console.log(`🔍 尝试action [${index + 1}/${testActions.length}]:`, test.action);
        
        wx.request({
          url: 'https://fc-mp-22bc083a-75be-471b-a448-e1e547b31823.next.bspapp.com/api/chapter',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          data: JSON.stringify({
            ...test.params,
            action: test.action,
            _timestamp: Date.now(),
            _platform: 'miniprogram'
          }),
          success: (res) => {
            console.log(`✅ action "${test.action}" 响应:`, {
              status: res.statusCode,
              data: res.data
            });
            
            if (res.statusCode === 200) {
              // 尝试解析响应
              const chapters = this.parseChapterResponse(res.data);
              if (chapters && chapters.length > 0) {
                console.log(`🎉 action "${test.action}" 成功解析:`, chapters.length, '个章节');
                resolve(chapters);
              } else {
                console.log(`⚠️ action "${test.action}" 解析到空数据，尝试下一个`);
                setTimeout(() => tryAction(index + 1), 100);
              }
            } else {
              console.log(`❌ action "${test.action}" HTTP错误:`, res.statusCode);
              setTimeout(() => tryAction(index + 1), 100);
            }
          },
          fail: (err) => {
            console.error(`❌ action "${test.action}" 请求失败:`, err);
            setTimeout(() => tryAction(index + 1), 100);
          }
        });
      };
      
      // 开始尝试
      tryAction(0);
    });
  },
  
  /**
   * 🚨 尝试使用封装API
   */
  tryCloudAPIChapterService: function(bookId) {
    console.log('🔍 尝试使用封装API，bookId:', bookId);
    
    return new Promise((resolve, reject) => {
      cloudAPI.chapter.getList(bookId, { pageSize: 100 })
        .then(response => {
          console.log('✅ 封装API响应:', response);
          
          const chapters = this.parseChapterResponse(response);
          if (chapters && chapters.length > 0) {
            resolve(chapters);
          } else {
            reject(new Error('封装API返回空数据'));
          }
        })
        .catch(err => {
          console.error('❌ 封装API调用失败:', err);
          reject(err);
        });
    });
  },
  
  /**
   * 🚨 解析章节响应（处理多种格式）
   */
  parseChapterResponse: function(response) {
    console.log('🔍 解析章节响应:', response);
    
    let chapters = [];
    
    if (!response) {
      console.log('⚠️ 响应为空');
      return chapters;
    }
    
    // 🚨 格式1：标准响应格式 {code: 0, data: {list: [...]}}
    if (response.code === 0 && response.data) {
      if (response.data.list && Array.isArray(response.data.list)) {
        chapters = response.data.list;
        console.log('📊 格式1: 标准响应格式, list字段');
      } else if (Array.isArray(response.data)) {
        chapters = response.data;
        console.log('📊 格式1: 标准响应格式, data数组');
      }
    }
    // 🚨 格式2：直接包含list字段 {list: [...]}
    else if (response.list && Array.isArray(response.list)) {
      chapters = response.list;
      console.log('📊 格式2: 直接list字段');
    }
    // 🚨 格式3：直接是数组 [...]
    else if (Array.isArray(response)) {
      chapters = response;
      console.log('📊 格式3: 直接数组');
    }
    // 🚨 格式4：包含data字段 {data: [...]}
    else if (response.data && Array.isArray(response.data)) {
      chapters = response.data;
      console.log('📊 格式4: data字段数组');
    }
    // 🚨 格式5：可能还有其他字段名
    else if (response.chapters && Array.isArray(response.chapters)) {
      chapters = response.chapters;
      console.log('📊 格式5: chapters字段');
    }
    else if (response.items && Array.isArray(response.items)) {
      chapters = response.items;
      console.log('📊 格式5: items字段');
    }
    else {
      // 🚨 尝试从响应中查找数组
      for (const key in response) {
        if (Array.isArray(response[key])) {
          chapters = response[key];
          console.log(`📊 格式6: 找到数组字段 "${key}"`);
          break;
        }
      }
    }
    
    console.log('📊 解析结果:', chapters.length, '个章节');
    
    // 🚨 排序章节
    if (chapters.length > 0) {
      chapters = chapters.sort((a, b) => {
        return (a.sort || a.chapterNumber || a.order || a.index || 0) - 
               (b.sort || b.chapterNumber || b.order || b.index || 0);
      });
      
      // 🚨 添加调试信息
      console.log('📊 排序后的章节:', chapters.map(c => ({
        id: c._id || c.id,
        title: c.title,
        sort: c.sort,
        audioUrl: c.audioUrl
      })));
    }
    
    return chapters;
  },
  
  /**
   * 🚨 加载本地章节列表（备用）
   */
  loadLocalChapterList: function(bookId) {
    console.log('📱 加载本地备用章节列表:', bookId);
    
    return new Promise((resolve, reject) => {
      // 🚨 本地模拟数据（可以根据你的实际情况调整）
      const localChapters = {
        '101': [
          { 
            _id: 'C10101', 
            bookId: '101', 
            title: '第1课 英语学习', 
            sort: 1, 
            audioUrl: '/audio/101/chapter1.mp3', 
            duration: 273,
            fileSize: 39174626,
            isFree: 'True',
            wordCount: 682
          },
          { 
            _id: 'C10102', 
            bookId: '101', 
            title: '第2课 日常对话', 
            sort: 2, 
            audioUrl: '/audio/101/chapter2.mp3', 
            duration: 320,
            fileSize: 45000000,
            isFree: 'True',
            wordCount: 800
          },
          { 
            _id: 'C10103', 
            bookId: '101', 
            title: '第3课 旅行英语', 
            sort: 3, 
            audioUrl: '/audio/101/chapter3.mp3', 
            duration: 285,
            fileSize: 42000000,
            isFree: 'True',
            wordCount: 710
          }
        ],
        '102': [
          { 
            _id: 'C10201', 
            bookId: '102', 
            title: '第1课 商务会议', 
            sort: 1, 
            audioUrl: '/audio/102/chapter1.mp3', 
            duration: 300,
            fileSize: 44000000,
            isFree: 'True',
            wordCount: 750
          },
          { 
            _id: 'C10202', 
            bookId: '102', 
            title: '第2课 邮件写作', 
            sort: 2, 
            audioUrl: '/audio/102/chapter2.mp3', 
            duration: 350,
            fileSize: 52000000,
            isFree: 'True',
            wordCount: 875
          }
        ]
      };
      
      const chapters = localChapters[bookId] || [];
      
      if (chapters.length === 0) {
        // 🚨 如果本地也没有，创建一个默认章节
        console.log('⚠️ 本地也没有数据，创建默认章节');
        const defaultChapter = {
          _id: `BC${bookId}001`,
          bookId: bookId,
          title: '第1课',
          sort: 1,
          audioUrl: `/audio/${bookId}/chapter1.mp3`,
          duration: 300,
          fileSize: 40000000,
          isFree: 'True',
          wordCount: 700
        };
        resolve([defaultChapter]);
      } else {
        console.log('✅ 本地备用数据:', chapters.length, '个章节');
        resolve(chapters);
      }
    });
  },
  
  /**
   * 直接调用章节服务（备用方案）
   */
  directCallChapterService: function(bookId) {
    return new Promise((resolve, reject) => {
      console.log('🔧 尝试直接调用云函数...');
      
      const token = wx.getStorageSync('token');
      
      wx.request({
        url: 'https://fc-mp-22bc083a-75be-471b-a448-e1e547b31823.next.bspapp.com/api/chapter',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        data: JSON.stringify({
          action: 'getChapterList',
          bookId: bookId,
          page: 1,
          pageSize: 100,
          _timestamp: Date.now(),
          _platform: 'miniprogram'
        }),
        success: (res) => {
          console.log('✅ 直接调用响应:', res.data);
          
          if (res.statusCode === 200) {
            // 尝试解析响应
            let chapters = [];
            const response = res.data;
            
            if (response && response.code === 0 && response.data && response.data.list) {
              chapters = response.data.list;
            } else if (response && response.code === 0 && response.data && Array.isArray(response.data)) {
              chapters = response.data;
            } else if (response && response.list) {
              chapters = response.list;
            } else if (response && Array.isArray(response)) {
              chapters = response;
            }
            
            console.log('📊 直接调用提取的章节:', chapters.length);
            
            if (chapters.length === 0) {
              reject(new Error('章节列表为空'));
            } else {
              // 排序
              const sortedChapters = chapters.sort((a, b) => {
                return (a.sort || a.chapterNumber || a.order || 0) - (b.sort || b.chapterNumber || b.order || 0);
              });
              resolve(sortedChapters);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`));
          }
        },
        fail: (err) => {
          console.error('❌ 直接调用失败:', err);
          reject(err);
        }
      });
    });
  },

/**
 * 从UniCloud加载章节详情（混合模式）
 */
loadChapterDetailFromCloud: function(chapterId) {
    console.log('🔍 加载章节详情（混合模式）:', chapterId);
    
    return new Promise((resolve, reject) => {
      // 🚨 首先尝试云端
      this.directDebugChapterDetail(chapterId)
        .then(chapterDetail => {
          if (chapterDetail) {
            console.log('✅ 云端章节详情成功');
            resolve(chapterDetail);
          } else {
            // 云端失败，使用本地
            console.log('🔄 云端章节详情失败，使用本地');
            this.loadLocalChapterDetail(chapterId).then(resolve).catch(reject);
          }
        })
        .catch(err => {
          console.error('❌ 云端章节详情失败:', err.message);
          
          // 🚨 尝试封装API
          this.tryCloudAPIChapterDetail(chapterId)
            .then(chapterDetail => {
              if (chapterDetail) {
                resolve(chapterDetail);
              } else {
                this.loadLocalChapterDetail(chapterId).then(resolve).catch(reject);
              }
            })
            .catch(() => {
              this.loadLocalChapterDetail(chapterId).then(resolve).catch(reject);
            });
        });
    });
  },
  
  /**
   * 🚨 直接调试调用章节详情
   */
  directDebugChapterDetail: function(chapterId) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      
      wx.request({
        url: 'https://fc-mp-22bc083a-75be-471b-a448-e1e547b31823.next.bspapp.com/api/chapter',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        data: JSON.stringify({
          action: 'getChapterDetail',
          chapterId: chapterId,
          _timestamp: Date.now(),
          _platform: 'miniprogram'
        }),
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            const detail = this.parseChapterDetailResponse ? this.parseChapterDetailResponse(res.data) : null;
            if (detail) {
              resolve(detail);
            } else {
              reject(new Error('无法解析章节详情'));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        },
        fail: reject
      });
    });
  },
  
  /**
   * 🚨 加载本地章节详情（备用）
   */
  loadLocalChapterDetail: function(chapterId) {
    console.log('📱 加载本地章节详情:', chapterId);
    
    return new Promise((resolve) => {
      // 🚨 模拟章节详情
      const chapterDetail = {
        _id: chapterId,
        title: '章节内容',
        bookId: chapterId.substring(1, 4), // 从ID中提取bookId
        audioUrl: this.generateLocalAudioUrl(chapterId),
        duration: 300,
        fileSize: 40000000,
        wordCount: 700,
        isFree: 'True',
        createTime: Date.now()
      };
      
      console.log('✅ 本地章节详情:', chapterDetail);
      resolve(chapterDetail);
    });
  },
  
  /**
   * 🚨 生成本地音频URL
   */
  generateLocalAudioUrl: function(chapterId) {
    // 从章节ID中提取信息
    // 假设格式: C10101 -> bookId=101, chapterNumber=1
    let bookId = '101';
    let chapterNumber = 1;
    
    if (chapterId.startsWith('C') && chapterId.length >= 5) {
      bookId = chapterId.substring(1, 4); // 取第2-4位
      const lastTwo = chapterId.slice(-2);
      chapterNumber = parseInt(lastTwo) || 1;
    }
    
    return `/audio/${bookId}/chapter${chapterNumber}.mp3`;
  },

  /**
   * 加载字幕
   */
  loadSubtitle: function(chapterId) {
    cloudAPI.chapter.getSubtitle(chapterId)
      .then(response => {
        if (response && response.code === 0 && response.data) {
          const subtitle = response.data.subtitle;
          if (subtitle && subtitle.length > 0) {
            this.setData({ subtitle: subtitle });
            console.log('✅ 字幕加载成功:', subtitle.length, '条');
          }
        }
      })
      .catch(err => {
        console.log('字幕加载失败或没有字幕:', err.message);
      });
  },

  /**
   * 设置音频源
   */
  setAudioSource: function(chapterDetail) {
    console.log('🎵 设置音频源:', chapterDetail.audioUrl);
    
    return new Promise((resolve, reject) => {
      if (!this.data.audioContext) {
        reject(new Error('音频上下文未初始化'));
        return;
      }
      
      const audioUrl = chapterDetail.audioUrl;
      if (!audioUrl) {
        reject(new Error('音频地址无效'));
        return;
      }
      
      // 设置音频源
      this.data.audioContext.src = audioUrl;
      
      console.log('✅ 音频源设置完成');
      resolve();
    });
  },

  // ==================== 音频控制函数 ====================

  /**
   * 播放/暂停
   */
  togglePlay: function() {
    if (this.data.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  },

  /**
   * 开始播放
   */
  play: function() {
    if (!this.data.audioContext) {
      console.error('❌ 音频上下文未初始化');
      return;
    }
    
    if (this.data.showError) {
      this.setData({ showError: false });
    }
    
    this.data.audioContext.play();
    
    // 自动隐藏控制按钮
    this.autoHideControls();
  },

  /**
   * 暂停播放
   */
  pause: function() {
    if (this.data.audioContext && this.data.isPlaying) {
      this.data.audioContext.pause();
      this.savePlayProgress();
    }
  },

  /**
   * 停止播放
   */
  stop: function() {
    if (this.data.audioContext) {
      this.data.audioContext.stop();
      this.setData({ 
        currentTime: 0,
        isPlaying: false 
      });
      this.stopProgressTimer();
    }
  },

  /**
   * 跳转到指定时间
   */
  seekTo: function(time) {
    if (!this.data.audioContext) {
      return;
    }
    
    const duration = this.data.duration || this.data.currentChapter?.duration || 0;
    const safeTime = Math.max(0, Math.min(time, duration));
    
    console.log('🎯 跳转到:', safeTime, '秒');
    
    this.data.audioContext.seek(safeTime);
    this.setData({ currentTime: safeTime });
  },

  /**
   * 上一章
   */
  prevChapter: function() {
    if (this.data.chapters.length === 0) {
      return;
    }
    
    const currentIndex = this.data.chapterIndex;
    if (currentIndex > 0) {
      const prevChapter = this.data.chapters[currentIndex - 1];
      this.playChapter(prevChapter, currentIndex - 1);
    } else {
      wx.showToast({
        title: '已经是第一章了',
        icon: 'none',
        duration: 1500
      });
    }
  },

  /**
   * 下一章
   */
  nextChapter: function() {
    if (this.data.chapters.length === 0) {
      return;
    }
    
    const currentIndex = this.data.chapterIndex;
    if (currentIndex < this.data.chapters.length - 1) {
      const nextChapter = this.data.chapters[currentIndex + 1];
      this.playChapter(nextChapter, currentIndex + 1);
    } else {
      wx.showToast({
        title: '已经是最后一章了',
        icon: 'none',
        duration: 1500
      });
    }
  },

  /**
   * 播放指定章节
   */
  playChapter: function(chapter, index) {
    console.log('🎵 播放章节:', chapter.title, '索引:', index);
    
    if (!chapter || !chapter._id) {
      console.error('❌ 无效的章节数据');
      return;
    }
    
    wx.showLoading({ title: '切换中...' });
    
    this.loadChapterDetailFromCloud(chapter._id)
      .then(chapterDetail => {
        // 停止当前播放
        if (this.data.audioContext) {
          this.data.audioContext.stop();
        }
        
        // 更新状态
        this.setData({
          currentChapter: chapterDetail,
          chapterIndex: index,
          currentTime: 0,
          isPlaying: false,
          subtitle: []
        });
        
        // 设置音频源
        return this.setAudioSource(chapterDetail);
      })
      .then(() => {
        wx.hideLoading();
        
        // 自动播放
        setTimeout(() => {
          this.play();
        }, 300);
        
        // 更新播放记录
        this.updateCurrentPlayRecord();
        
        // 加载字幕
        this.loadSubtitle(chapter._id);
      })
      .catch(err => {
        wx.hideLoading();
        console.error('❌ 切换章节失败:', err);
        
        wx.showToast({
          title: '切换失败',
          icon: 'error',
          duration: 2000
        });
      });
  },

  /**
   * 切换播放速度
   */
  changePlaybackRate: function(rate) {
    if (this.data.audioContext) {
      this.data.audioContext.playbackRate = rate;
      this.setData({ playbackRate: rate });
      console.log('⚡ 播放速度改为:', rate);
    }
  },

  /**
   * 调整音量
   */
  changeVolume: function(volume) {
    if (this.data.audioContext) {
      const normalizedVolume = Math.max(0, Math.min(volume, 100)) / 100;
      this.data.audioContext.volume = normalizedVolume;
      this.setData({ volume: volume });
      console.log('🔊 音量改为:', volume);
    }
  },

  // ==================== 事件处理函数 ====================

  /**
   * 处理音频播放错误
   */
  handleAudioError: function(error) {
    console.error('🎵 音频错误处理:', error);
    
    const errorMsg = error.errMsg || '播放失败';
    
    // 尝试备用音频源
    if (this.data.currentChapter) {
      console.log('🔄 尝试备用音频源...');
      
      // 使用网络备用音频
      const fallbackUrl = 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3';
      
      // 尝试本地备用音频
      const localFallback = this.data.currentChapter.audioUrl?.replace('/audio/', '/audio/fallback/');
      
      this.data.audioContext.src = localFallback || fallbackUrl;
      
      wx.showToast({
        title: '已切换到备用音频',
        icon: 'none',
        duration: 2000
      });
    } else {
      this.setData({
        showError: true,
        errorMessage: errorMsg
      });
    }
  },

  /**
   * 处理播放结束
   */
  handlePlayEnded: function() {
    console.log('🎵 播放结束处理');
    
    // 标记为已完成
    this.markChapterAsCompleted();
    
    // 保存播放进度
    this.savePlayProgress();
    
    // 根据播放模式决定下一步
    switch (this.data.playMode) {
      case 'repeat_one':
        // 重复播放当前章节
        setTimeout(() => {
          this.seekTo(0);
          this.play();
        }, 1000);
        break;
        
      case 'shuffle':
        // 随机播放下一章
        const randomIndex = Math.floor(Math.random() * this.data.chapters.length);
        if (randomIndex !== this.data.chapterIndex) {
          setTimeout(() => {
            this.playChapter(this.data.chapters[randomIndex], randomIndex);
          }, 1500);
        }
        break;
        
      case 'sequential':
      default:
        // 顺序播放下一章
        setTimeout(() => {
          this.nextChapter();
        }, 1500);
        break;
    }
  },

  /**
   * 更新字幕位置
   */
  updateSubtitlePosition: function() {
    if (!this.data.audioContext || !this.data.subtitle.length) {
      return;
    }
    
    const currentTime = this.data.audioContext.currentTime || this.data.currentTime;
    
    // 查找当前时间对应的字幕
    for (let i = 0; i < this.data.subtitle.length; i++) {
      const subtitle = this.data.subtitle[i];
      if (currentTime >= subtitle.start && currentTime <= subtitle.end) {
        if (this.data.currentSubtitleIndex !== i) {
          this.setData({ currentSubtitleIndex: i });
        }
        return;
      }
    }
    
    // 如果没有找到匹配的字幕
    if (this.data.currentSubtitleIndex !== -1) {
      this.setData({ currentSubtitleIndex: -1 });
    }
  },

  // ==================== 数据同步函数 ====================

  /**
   * 更新当前播放记录（修复版）
   */
  updateCurrentPlayRecord: function() {
    console.log('📝 开始更新播放记录...');
    
    // 🚨 验证1：检查必要数据是否存在
    if (!this.data.currentBook || !this.data.currentChapter) {
      console.error('❌ 无法更新播放记录：缺少书籍或章节数据');
      console.log('📊 当前状态:', {
        有书籍: !!this.data.currentBook,
        有章节: !!this.data.currentChapter,
        书籍数据: this.data.currentBook,
        章节数据: this.data.currentChapter
      });
      return;
    }
    
    // 🚨 验证2：确保获取到有效的ID
    const bookId = this.data.currentBook._id || this.data.currentBook.id || this.data.currentBook.bookId;
    const chapterId = this.data.currentChapter._id || this.data.currentChapter.id || this.data.currentChapter.chapterId;
    
    if (!bookId || !chapterId) {
      console.error('❌ 无法更新播放记录：缺少有效的书籍ID或章节ID', {
        书籍数据: this.data.currentBook,
        章节数据: this.data.currentChapter,
        提取的书籍ID: bookId,
        提取的章节ID: chapterId
      });
      return;
    }
    
    // 🚨 验证3：确保有合理的进度值
    const currentTime = this.data.currentTime || 0;
    const duration = this.data.duration || this.data.currentChapter.duration || 0;
    
    const currentPlay = {
      bookId: bookId,
      bookTitle: this.data.currentBook.title || '未知书籍',
      bookCover: this.data.currentBook.cover || this.data.currentBook.image || '/images/covers/default.jpg',
      chapterId: chapterId,
      chapterTitle: this.data.currentChapter.title || '未知章节',
      progress: currentTime,
      duration: duration,
      playTime: Date.now()
    };
    
    console.log('✅ 播放记录数据:', currentPlay);
    
    // 保存到本地
    playbackManager.setCurrentPlay(currentPlay);
    
    // 如果用户已登录，同步到云端
    if (this.data.isLoggedIn) {
      this.syncCurrentPlayToCloud(currentPlay);
    }
  },

  /**
   * 保存播放进度（修复版）
   */
  savePlayProgress: function() {
    console.log('💾 开始保存播放进度...');
    
    if (!this.data.currentBook || !this.data.currentChapter) {
      console.log('⚠️ 无法保存播放进度：缺少书籍或章节信息');
      return;
    }
    
    const bookId = this.data.currentBook._id || this.data.currentBook.id;
    const chapterId = this.data.currentChapter._id || this.data.currentChapter.id;
    
    if (!bookId || !chapterId) {
      console.error('❌ 无法保存播放进度：缺少书籍ID或章节ID');
      return;
    }
    
    const currentTime = this.data.currentTime || 0;
    const duration = this.data.duration || this.data.currentChapter.duration || 0;
    
    const progressData = {
      bookId: bookId,
      chapterId: chapterId,
      progress: currentTime,
      duration: duration,
      playTime: Date.now()
    };
    
    console.log('✅ 播放进度数据:', progressData);
    
    // 保存到本地
    playbackManager.savePlayProgress(progressData);
    
    // 如果用户已登录且进度有意义，同步到云端
    if (this.data.isLoggedIn && currentTime >= 0) {
      // 即使进度是0也要同步（标记为开始播放）
      this.syncPlayProgressToCloud(progressData);
    }
  },

  /**
   * 标记章节为已完成（修复版）
   */
  markChapterAsCompleted: function() {
    console.log('✅ 标记章节为已完成...');
    
    if (!this.data.currentBook || !this.data.currentChapter) {
      console.log('⚠️ 无法标记完成：缺少书籍或章节信息');
      return;
    }
    
    const bookId = this.data.currentBook._id || this.data.currentBook.id;
    const chapterId = this.data.currentChapter._id || this.data.currentChapter.id;
    
    if (!bookId || !chapterId) {
      console.error('❌ 无法标记完成：缺少书籍ID或章节ID');
      return;
    }
    
    const completeData = {
      bookId: bookId,
      chapterId: chapterId,
      completed: true,
      completeTime: Date.now()
    };
    
    console.log('✅ 完成数据:', completeData);
    
    // 保存到本地
    playbackManager.recordComplete(completeData);
    
    // 如果用户已登录，同步到云端
    if (this.data.isLoggedIn) {
      this.syncChapterCompleteToCloud(completeData);
    }
  },

  /**
   * 同步当前播放到云端（修复版）
   */
  syncCurrentPlayToCloud: function(currentPlay) {
    console.log('📤 开始同步当前播放到云端:', currentPlay);
    
    // 🚨 检查必要参数 - 增强验证
    if (!currentPlay) {
      console.error('❌ 无法同步：currentPlay为空');
      return;
    }
    
    // 🚨 确保章节ID有效
    const chapterId = currentPlay.chapterId;
    if (!chapterId) {
      console.error('❌ 无法同步：缺少章节ID', currentPlay);
      return;
    }
    
    // 🚨 确保 progress 有值，即使是 0
    const progress = currentPlay.progress !== undefined ? currentPlay.progress : 0;
    const duration = currentPlay.duration || 0;
    
    // 🚨 如果 progress 是 null 或 undefined，设置为 0
    const safeProgress = (progress === null || progress === undefined) ? 0 : progress;
    
    console.log('📊 同步参数:', {
      chapterId: chapterId,
      progress: safeProgress,
      duration: duration
    });
    
    // 🚨 关键修复：使用 chapter.updateProgress 而不是 player.savePlayProgress
    cloudAPI.chapter.updateProgress({
      chapterId: chapterId,
      progress: safeProgress,
      duration: duration,
      completed: false
    })
    .then((result) => {
      console.log('✅ 当前播放已同步到云端', result);
    })
    .catch(err => {
      console.error('❌ 同步当前播放失败:', err.message || err);
      
      // 🚨 记录详细错误信息
      console.log('错误详情:', {
        错误消息: err.message,
        错误代码: err.code,
        错误数据: err.data,
        是否是网络错误: err.code === 'NETWORK_ERROR'
      });
      
      // 🚨 如果是因为章节ID为空，记录但不阻止后续操作
      if (err.message && err.message.includes('章节ID不能为空')) {
        console.log('⚠️ 章节ID验证失败，但继续本地保存');
      }
    });
  },

  /**
   * 同步播放进度到云端（修复版）
   */
  syncPlayProgressToCloud: function(progressData) {
    console.log('📤 同步播放进度到云端:', progressData);
    
    // 🚨 参数验证
    if (!progressData || !progressData.chapterId) {
      console.error('❌ 无法同步播放进度：缺少章节ID', progressData);
      return;
    }
    
    const safeProgress = progressData.progress !== undefined ? progressData.progress : 0;
    const duration = progressData.duration || 0;
    
    console.log('📊 进度同步参数:', {
      chapterId: progressData.chapterId,
      progress: safeProgress,
      duration: duration
    });
    
    // 🚨 关键修复：使用 chapter.updateProgress
    cloudAPI.chapter.updateProgress({
      chapterId: progressData.chapterId,
      progress: safeProgress,
      duration: duration,
      completed: false
    })
    .then(() => {
      console.log('✅ 播放进度已同步到云端');
    })
    .catch(err => {
      console.error('❌ 同步播放进度失败:', err);
      
      // 🚨 记录详细错误
      console.log('错误详情:', {
        错误消息: err.message,
        错误代码: err.code
      });
    });
  },

  /**
   * 同步章节完成状态到云端（修复版）
   */
  syncChapterCompleteToCloud: function(completeData) {
    console.log('📤 同步章节完成状态:', completeData);
    
    if (!completeData || !completeData.chapterId) {
      console.error('❌ 无法同步完成状态：缺少章节ID', completeData);
      return;
    }
    
    // 🚨 完成状态使用 chapter.updateProgress，但设置 completed 为 true
    cloudAPI.chapter.updateProgress({
      chapterId: completeData.chapterId,
      progress: 100, // 假设完成时进度为100%
      duration: completeData.duration || 0,
      completed: true
    })
    .then(() => {
      console.log('✅ 章节完成状态已同步到云端');
    })
    .catch(err => {
      console.error('❌ 同步章节完成状态失败:', err);
      
      // 🚨 记录详细错误
      console.log('错误详情:', {
        错误消息: err.message,
        错误代码: err.code
      });
    });
  },

  // ==================== UI辅助函数 ====================

  /**
   * 自动隐藏控制按钮
   */
  autoHideControls: function() {
    // 清除之前的定时器
    if (this.data.autoHideTimer) {
      clearTimeout(this.data.autoHideTimer);
    }
    
    // 显示控制按钮
    this.setData({ showControls: true });
    
    // 设置5秒后隐藏
    const timer = setTimeout(() => {
      this.setData({ showControls: false });
    }, 5000);
    
    this.setData({ autoHideTimer: timer });
  },

  /**
   * 开始进度更新定时器
   */
  startProgressTimer: function() {
    this.stopProgressTimer();
    
    this.data.progressTimer = setInterval(() => {
      if (this.data.audioContext && this.data.isPlaying) {
        this.setData({
          currentTime: this.data.audioContext.currentTime,
          duration: this.data.audioContext.duration || this.data.duration
        });
      }
    }, 500);
  },

  /**
   * 停止进度更新定时器
   */
  stopProgressTimer: function() {
    if (this.data.progressTimer) {
      clearInterval(this.data.progressTimer);
      this.data.progressTimer = null;
    }
  },

  /**
   * 清除所有定时器
   */
  clearTimers: function() {
    if (this.data.autoHideTimer) {
      clearTimeout(this.data.autoHideTimer);
      this.setData({ autoHideTimer: null });
    }
    
    this.stopProgressTimer();
  },

  /**
   * 显示无内容引导
   */
  showNoContentGuide: function() {
    this.setData({
      showError: true,
      errorMessage: '没有找到可播放的内容'
    });
    
    wx.showModal({
      title: '提示',
      content: '您还没有开始学习任何课程，请先选择一本书开始学习。',
      confirmText: '去选书',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }
    });
  },

  /**
   * 获取备用书籍信息
   */
  getFallbackBookInfo: function(bookId) {
    const fallbackBooks = {
      '101': {
        _id: '101',
        title: '英语学习入门',
        cover: '/images/covers/english.jpg',
        author: '系统推荐',
        description: '适合初学者的英语学习材料'
      },
      '102': {
        _id: '102',
        title: '商务英语',
        cover: '/images/covers/business.jpg',
        author: '商务英语团队',
        description: '提升职场英语能力'
      }
    };
    
    return fallbackBooks[bookId] || null;
  },

  // ==================== 页面事件处理 ====================

  onProgressSliderChange: function(e) {
    const value = e.detail.value;
    this.seekTo(value);
  },

  onPlaylistToggle: function() {
    this.setData({ showPlaylist: !this.data.showPlaylist });
  },

  onSubtitleToggle: function() {
    this.setData({ showSubtitle: !this.data.showSubtitle });
  },

  onRateChange: function(e) {
    const rate = parseFloat(e.detail.value);
    this.changePlaybackRate(rate);
  },

  onVolumeChange: function(e) {
    const volume = parseInt(e.detail.value);
    this.changeVolume(volume);
  },

  onChapterSelect: function(e) {
    const { index } = e.currentTarget.dataset;
    const chapter = this.data.chapters[index];
    this.playChapter(chapter, index);
    this.setData({ showPlaylist: false });
  },

  onModeChange: function(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ playMode: mode });
    console.log('🎛️ 播放模式改为:', mode);
  },

  onRetry: function() {
    if (this.data.currentChapter) {
      this.setData({ showError: false });
      this.setAudioSource(this.data.currentChapter)
        .then(() => {
          this.play();
        })
        .catch(err => {
          console.error('❌ 重试失败:', err);
        });
    }
  },

  onBack: function() {
    wx.navigateBack();
  },

  onTapScreen: function() {
    this.autoHideControls();
  },

  onErrorTap: function() {
    this.setData({ showError: false });
  }
});