// pages/book-detail/book-detail.js
const { callCloud, cloudAPI } = require('../../utils/uni-cloud');
const userStatus = require('../../utils/user-status');
const StorageManager = require('../../utils/storage-manager'); // 添加存储管理

Page({
  data: {
    // 书籍基本信息
    bookId: '',
    bookInfo: {},
    
    // 界面状态
    expandedDescription: false,
    showAllChapters: false,
    showBottomBar: false,
    headerTitleVisible: false,
    showSharePanel: false,
    
    // 数据列表
    chapters: [],
    similarBooks: [],
    comments: [],
    
    // 统计信息
    commentCount: 0,
    playProgress: 0,
    
    // 加载状态
    loading: true,
    error: false,
    errorMessage: '',
    
    // 音频相关
    audioPlaying: false,
    currentAudioId: null,
    
    // 用户状态
    isFavorite: false,
    isDownloaded: false,
    
    // 🚨 新增：登录状态
    isLoggedIn: false,
    currentUserId: 0,
    
    // 本地数据（备用）
    mockDataEnabled: false
  },

  // 在 book-detail.js 的 onLoad 中修改
  onLoad: function(options) {
    console.log('📚 书籍详情页加载，参数:', options);
    
    const bookId = options.id || options.bookId || '';
    if (!bookId) {
      wx.showToast({
        title: '书籍ID不能为空',
        icon: 'error',
        duration: 2000
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
      return;
    }
    
    // 🚨 修复：使用正确的方法获取登录状态
    const isLoggedIn = userStatus.isLoggedIn();
    const currentUserId = userStatus.getCurrentUserId();
    const token = userStatus.getToken();
    const hasToken = !!token;
    
    console.log('🔍 页面登录状态:', {
      isLoggedIn: isLoggedIn,
      userId: currentUserId,
      hasToken: hasToken,
      token长度: token ? token.length : 0
    });
    
    this.setData({ 
      bookId: bookId,
      loading: true,
      isLoggedIn: isLoggedIn,
      currentUserId: currentUserId
    });
    
    // 设置页面标题为加载中
    wx.setNavigationBarTitle({
      title: '加载中...'
    });
    
    // 直接加载真实数据
    this.loadBookDetail(bookId);
  },
  
  // 🚨 修复：收藏状态检查，使用正确的方法获取登录状态
  async checkFavoriteStatus() {
    try {
      const bookId = this.data.bookId;
      if (!bookId) return;
      
      // 🚨 使用正确的方法重新检查登录状态
      const isLoggedIn = userStatus.isLoggedIn();
      const currentUserId = userStatus.getCurrentUserId();
      const token = userStatus.getToken();
      const hasToken = !!token;
      
      if (!isLoggedIn || currentUserId <= 0) {
        console.log('用户未登录，跳过收藏状态检查');
        this.setData({ isFavorite: false });
        return;
      }
      
      console.log('🔍 检查收藏状态:', { 
        bookId: bookId, 
        userId: currentUserId,
        token存在: hasToken
      });
      
      // 🚨 如果token为空，直接返回未收藏
      if (!hasToken) {
        console.log('token为空，跳过API调用');
        this.setData({ isFavorite: false });
        return;
      }
      
      const result = await cloudAPI.shelf.check(bookId);
      console.log('收藏状态响应:', result);
      
      if (result && (result.success === true || result.data === true || result.code === 0)) {
        this.setData({
          isFavorite: true
        });
        console.log('✅ 已收藏');
      } else {
        this.setData({
          isFavorite: false
        });
        console.log('❌ 未收藏');
      }
    } catch (error) {
      console.error('❌ 检查收藏状态失败:', error);
      
      // 🚨 特殊处理登录错误
      if (error.isLoginError) {
        console.log('登录验证失败，提示用户重新登录');
        wx.showToast({
          title: '请重新登录',
          icon: 'none',
          duration: 2000
        });
      }
      
      this.setData({ isFavorite: false });
    }
  },

  // ============ 后端API调用 ============

  // 🚨 修复：加载书籍详情 - 直接调用 cloudAPI
  async loadBookDetail(bookId) {
    console.log('🔍 加载书籍详情:', bookId);
    
    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });

      // 🚨 直接使用 cloudAPI.book.getDetail，它会自动处理参数格式
      const bookResult = await cloudAPI.book.getDetail(bookId);
      console.log('📖 书籍详情响应:', bookResult);

      let bookInfo = {};
      
      // 🚨 修复：处理不同的响应格式
      if (bookResult) {
        // 1. 如果是标准API响应 {code: 0, data: {...}, success: true}
        if (bookResult.code === 0 && bookResult.data) {
          bookInfo = bookResult.data;
        }
        // 2. 如果直接返回数据对象 {_id: "802", title: "...", ...}
        else if (bookResult._id || bookResult.id) {
          bookInfo = bookResult;
        }
        // 3. 如果是 {success: true, data: {...}} 格式
        else if (bookResult.success === true && bookResult.data) {
          bookInfo = bookResult.data;
        }
        // 4. 如果是数组中的第一个元素
        else if (Array.isArray(bookResult) && bookResult.length > 0) {
          bookInfo = bookResult[0];
        }
        // 5. 如果是 {list: [...], pagination: {...}} 格式
        else if (bookResult.list && Array.isArray(bookResult.list) && bookResult.list.length > 0) {
          bookInfo = bookResult.list[0];
        }
      }

      // 🚨 检查是否获取到有效的书籍信息
      if (!bookInfo || (!bookInfo._id && !bookInfo.id)) {
        console.warn('⚠️ 书籍数据格式异常:', bookResult);
        throw new Error('书籍数据格式错误');
      }

      // 2. 并行加载其他数据
      const [chapters, similarBooks, commentsResult] = await Promise.all([
        this.loadChapters(bookId),
        this.loadSimilarBooks(bookInfo.categoryId),
        this.loadComments(bookId)
      ]);

      this.setData({
        bookInfo: bookInfo,
        chapters: chapters,
        similarBooks: similarBooks,
        comments: commentsResult.comments || [],
        commentCount: commentsResult.count || 0,
        loading: false,
        error: false
      });

      // 更新页面标题
      wx.setNavigationBarTitle({
        title: bookInfo.title || '书籍详情'
      });

      console.log('✅ 书籍详情加载完成:', {
        bookTitle: bookInfo.title,
        chaptersCount: chapters.length,
        similarBooksCount: similarBooks.length
      });

      wx.hideLoading();

      // 检查收藏和下载状态
      this.checkFavoriteStatus();
      this.checkDownloadStatus();

    } catch (error) {
      console.error('❌ 加载书籍详情失败:', error);
      
      this.setData({
        loading: false,
        error: true,
        errorMessage: error.message || '加载失败，请重试'
      });

      wx.hideLoading();
      
      // 🚨 尝试其他获取方式
      this.tryAlternativeMethods(bookId);
    }
  },

  // 🚨 新增：尝试其他获取方式
  async tryAlternativeMethods(bookId) {
    console.log('🔄 尝试其他获取方式:', bookId);
    
    try {
      // 方法1：通过搜索获取
      const searchResult = await cloudAPI.book.search(bookId, { limit: 1 });
      console.log('🔍 搜索结果:', searchResult);
      
      let bookInfo = null;
      
      if (searchResult && searchResult.code === 0 && searchResult.data && searchResult.data.length > 0) {
        bookInfo = searchResult.data[0];
      } else if (Array.isArray(searchResult) && searchResult.length > 0) {
        bookInfo = searchResult[0];
      }
      
      if (bookInfo) {
        console.log('✅ 通过搜索找到书籍:', bookInfo.title);
        
        const [chapters, similarBooks, commentsResult] = await Promise.all([
          this.loadChapters(bookId),
          this.loadSimilarBooks(bookInfo.categoryId),
          this.loadComments(bookId)
        ]);
        
        this.setData({
          bookInfo: bookInfo,
          chapters: chapters,
          similarBooks: similarBooks,
          comments: commentsResult.comments || [],
          commentCount: commentsResult.count || 0,
          loading: false,
          error: false
        });
        
        wx.setNavigationBarTitle({
          title: bookInfo.title || '书籍详情'
        });

        // 检查收藏和下载状态
        this.checkFavoriteStatus();
        this.checkDownloadStatus();
        
        return;
      }
    } catch (searchError) {
      console.error('搜索也失败了:', searchError);
    }
    
    // 方法2：使用模拟数据
    wx.showToast({
      title: '使用模拟数据展示',
      icon: 'none',
      duration: 2000
    });
    
    setTimeout(() => {
      this.setData({ mockDataEnabled: true });
      this.loadMockData(bookId);
    }, 1500);
  },

  // 加载章节列表
  async loadChapters(bookId) {
    try {
      console.log('📋 加载章节列表:', bookId);
      
      const result = await cloudAPI.chapter.getList(bookId);
      console.log('📋 章节列表响应:', result);
      
      let chapters = [];
      
      if (result) {
        if (result.code === 0 && result.data) {
          chapters = result.data;
        } else if (result.list && Array.isArray(result.list)) {
          chapters = result.list;
        } else if (Array.isArray(result)) {
          chapters = result;
        } else if (result.success === true && result.data) {
          chapters = result.data;
        }
      }
      
      // 修复音频URL
      chapters = chapters.map((chapter, index) => {
        const audioFilename = `chapter${index + 1}.mp3`;
        let audioUrl = chapter.audioUrl || chapter.audio || '';
        
        if (!audioUrl) {
          audioUrl = `/audio/${audioFilename}`;
        }
        
        if (audioUrl && !audioUrl.startsWith('http') && !audioUrl.startsWith('/')) {
          audioUrl = '/' + audioUrl;
        }
        
        return {
          ...chapter,
          audioUrl: audioUrl,
          isCompleted: chapter.isCompleted || false,
          duration: chapter.duration || 0,
          playCount: chapter.playCount || 0
        };
      });
      
      console.log('✅ 章节列表处理完成，数量:', chapters.length);
      return chapters;
      
    } catch (error) {
      console.error('❌ 加载章节列表失败:', error);
      return this.generateMockChapters(bookId);
    }
  },

  // 加载相似书籍
  async loadSimilarBooks(categoryId) {
    try {
      console.log('📚 加载相似书籍，分类ID:', categoryId);
      
      const result = await cloudAPI.book.getByCategory(categoryId, {
        limit: 4
      });
      
      let similarBooks = [];
      
      if (result) {
        if (result.code === 0 && result.data) {
          similarBooks = result.data.slice(0, 4);
        } else if (result.list && Array.isArray(result.list)) {
          similarBooks = result.list.slice(0, 4);
        } else if (Array.isArray(result)) {
          similarBooks = result.slice(0, 4);
        }
      }
      
      console.log('✅ 相似书籍加载完成，数量:', similarBooks.length);
      return similarBooks;
      
    } catch (error) {
      console.error('❌ 加载相似书籍失败:', error);
      return this.generateMockSimilarBooks();
    }
  },

  // 加载评论
  async loadComments(bookId) {
    try {
      console.log('💬 加载评论:', bookId);
      
      const result = await cloudAPI.social.getComments(bookId, {
        limit: 5
      });
      
      let comments = [];
      let count = 0;
      
      if (result) {
        if (result.code === 0 && result.data) {
          comments = result.data.comments || result.data.list || [];
          count = result.data.total || result.data.count || comments.length;
        } else if (result.list && Array.isArray(result.list)) {
          comments = result.list;
          count = result.total || comments.length;
        } else if (Array.isArray(result)) {
          comments = result;
          count = result.length;
        }
      }
      
      console.log('✅ 评论加载完成，数量:', comments.length);
      return { comments, count };
      
    } catch (error) {
      console.error('❌ 加载评论失败:', error);
      return { comments: [], count: 0 };
    }
  },

  // 🚨 新增：检查下载状态
  checkDownloadStatus() {
    try {
      const bookId = this.data.bookId;
      if (!bookId) return;
      
      // 使用 StorageManager 检查下载状态
      const isDownloaded = StorageManager.isDownloaded(bookId);
      this.setData({
        isDownloaded: isDownloaded
      });
      console.log('下载状态:', isDownloaded ? '✅ 已下载' : '❌ 未下载');
    } catch (error) {
      console.error('❌ 检查下载状态失败:', error);
      this.setData({ isDownloaded: false });
    }
  },

  // ============ 模拟数据（备用方案） ============

  loadMockData(bookId) {
    console.log('🔄 加载模拟数据，书籍ID:', bookId);
    
    // 查找匹配的书籍
    const mockBook = this.findBookInCSV(bookId);
    
    if (mockBook) {
      this.setData({
        bookInfo: {
          ...mockBook,
          rating: 4.8,
          ratingCount: mockBook.likeCount || 1245,
          playCount: mockBook.popularity || 12567,
          tags: this.getCategoryTags(mockBook.categoryId),
          difficultyText: mockBook.level || '中级',
          isFavorite: false,
          isDownloaded: false,
          vocabularyCount: 850,
          grammarPoints: 12
        },
        chapters: this.generateMockChapters(bookId),
        similarBooks: this.generateMockSimilarBooks(),
        comments: this.generateMockComments(),
        commentCount: mockBook.commentCount || 28,
        loading: false,
        error: false
      });
      
      // 更新页面标题
      wx.setNavigationBarTitle({
        title: mockBook.title || '书籍详情'
      });
      
      console.log('✅ 模拟数据加载完成:', mockBook.title);
    } else {
      // 使用默认模拟数据
      this.setDefaultMockData();
    }
  },

  // 从CSV数据中查找书籍
  findBookInCSV(bookId) {
    try {
      const bookMap = {
        '101': { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', categoryId: 4, level: '中级' },
        '102': { title: 'Pride and Prejudice', author: 'Jane Austen', categoryId: 4, level: '中高级' },
        '103': { title: '1984', author: 'George Orwell', categoryId: 4, level: '高级' },
        '104': { title: 'To Kill a Mockingbird', author: 'Harper Lee', categoryId: 4, level: '中级' },
        '105': { title: 'The Catcher in the Rye', author: 'J.D. Salinger', categoryId: 4, level: '中级' },
        'B001': { title: 'Jane Eyre', author: 'Charlotte Brontë', categoryId: 4, level: '中级' },
        'B002': { title: 'Pride and Prejudice', author: 'Jane Austen', categoryId: 4, level: '中级' },
        'B003': { title: 'The Old Man and the Sea', author: 'Ernest Hemingway', categoryId: 4, level: '初级' },
        'B004': { title: 'Harry Potter and the Philosopher\'s Stone', author: 'J.K. Rowling', categoryId: 4, level: '初级' },
        'B005': { title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', categoryId: 4, level: '初级' },
        '402': { // 🚨 根据您的数据添加
          title: 'Bedtime English Stories',
          author: 'Peter White',
          cover: '/images/covers/kids2.jpg',
          description: '精选经典儿童英语睡前故事，帮助孩子在轻松愉快的氛围中学习英语，培养英语语感。',
          categoryId: 2,
          level: '入门',
          totalChapters: 15,
          totalDuration: 1200,
          likeCount: 1890,
          popularity: 7543
        }
      };
      
      return bookMap[bookId];
    } catch (error) {
      console.error('❌ 查找CSV数据失败:', error);
      return null;
    }
  },

  // 设置默认模拟数据
  setDefaultMockData() {
    this.setData({
      bookInfo: {
        id: this.data.bookId,
        title: 'Bedtime English Stories',
        author: 'Peter White',
        cover: '/images/covers/kids2.jpg',
        rating: 4.8,
        ratingCount: 1890,
        duration: 1200,
        playCount: 7543,
        chapterCount: 15,
        tags: ['儿童', '教育', '睡前故事'],
        difficultyLevel: 1,
        difficultyText: '入门',
        description: '精选经典儿童英语睡前故事，帮助孩子在轻松愉快的氛围中学习英语，培养英语语感。',
        isFavorite: false,
        isDownloaded: false,
        vocabularyCount: 500,
        grammarPoints: 8
      },
      chapters: this.generateMockChapters(this.data.bookId),
      similarBooks: this.generateMockSimilarBooks(),
      comments: this.generateMockComments(),
      commentCount: 28,
      loading: false,
      error: false
    });
    
    wx.setNavigationBarTitle({
      title: 'Bedtime English Stories'
    });
  },

  // 生成模拟章节
  generateMockChapters(bookId) {
    const chapterCount = 15;
    const chapters = [];
    
    for (let i = 1; i <= chapterCount; i++) {
      const duration = 80;
      const audioFilename = `chapter${i}.mp3`;
      
      const chapterTitles = [
        'The Little Red Hen',
        'The Three Little Pigs',
        'Goldilocks and the Three Bears',
        'The Ugly Duckling',
        'The Lion and the Mouse',
        'The Tortoise and the Hare',
        'The Boy Who Cried Wolf',
        'The Ant and the Grasshopper',
        'The Fox and the Grapes',
        'The Wind and the Sun',
        'The City Mouse and the Country Mouse',
        'The Gingerbread Man',
        'Little Red Riding Hood',
        'Hansel and Gretel',
        'Sleeping Beauty'
      ];
      
      chapters.push({
        id: i,
        title: chapterTitles[i-1] || `Chapter ${i}: Bedtime Story`,
        duration: duration,
        isCompleted: i <= 2,
        audioUrl: `/audio/${audioFilename}`,
        playCount: Math.floor(Math.random() * 100)
      });
    }
    
    console.log('📊 生成的章节音频URL:', chapters.slice(0, 3).map(c => c.audioUrl));
    return chapters;
  },

  // 🚨 修复：模拟评论中的图片路径
  generateMockComments() {
    return [
      {
        id: 1,
        username: '英语爱好者',
        avatar: '/images/avatar/avatar1.png', // 🚨 修复：使用实际存在的图片
        rating: 5,
        content: '这本书的朗读非常棒，发音清晰，语速适中，非常适合英语学习者。',
        time: '2023-12-28 14:30:00'
      },
      {
        id: 2,
        username: '文学迷',
        avatar: '/images/avatar/avatar2.png', // 🚨 修复：使用实际存在的图片
        rating: 4,
        content: '经典名著，边听边学英语，一举两得。希望能有更多类似的经典作品。',
        time: '2023-12-27 10:15:00'
      }
    ];
  },

  getCategoryTags(categoryId) {
    const tagMap = {
      1: ['历史', '人文', '传记'],
      2: ['儿童', '教育', '启蒙', '睡前故事'],
      3: ['家庭', '生活', '健康'],
      4: ['文学', '经典', '小说'],
      5: ['职场', '技能', '商务'],
      6: ['科普', '知识', '科技'],
      7: ['旅游', '地理', '文化'],
      8: ['财经', '商业', '经济']
    };
    
    return tagMap[categoryId] || ['经典文学', '英语学习'];
  },

  generateMockSimilarBooks() {
    return [
      { 
        id: '402', 
        title: 'Bedtime English Stories', 
        author: 'Peter White', 
        cover: '/images/covers/kids2.jpg' 
      },
      { 
        id: '102', 
        title: 'Pride and Prejudice', 
        author: 'Jane Austen', 
        cover: '/images/covers/book2.jpg' 
      },
      { 
        id: '103', 
        title: '1984', 
        author: 'George Orwell', 
        cover: '/images/covers/book3.jpg' 
      },
      { 
        id: '104', 
        title: 'To Kill a Mockingbird', 
        author: 'Harper Lee', 
        cover: '/images/covers/book4.jpg' 
      }
    ];
  },

  // ============ 用户交互 ============

  // 🚨 修复：收藏功能
  toggleFavorite: async function() {
    const bookId = this.data.bookId;
    const currentStatus = this.data.isFavorite;
    const currentUserId = this.data.currentUserId;
    
    // 检查登录状态
    if (!this.data.isLoggedIn || currentUserId <= 0) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/login/login?from=book_detail&bookId=${bookId}`
        });
      }, 500);
      return;
    }
    
    try {
      if (currentStatus) {
        // 取消收藏
        await cloudAPI.shelf.remove(bookId);
        this.setData({ isFavorite: false });
        wx.showToast({
          title: '已取消收藏',
          icon: 'success',
          duration: 1000
        });
      } else {
        // 添加收藏
        await cloudAPI.shelf.add(bookId);
        this.setData({ isFavorite: true });
        wx.showToast({
          title: '已收藏',
          icon: 'success',
          duration: 1000
        });
      }
    } catch (error) {
      console.error('❌ 收藏操作失败:', error);
      
      // 如果API失败，使用本地存储
      const favorites = wx.getStorageSync('favorites') || [];
      
      if (currentStatus) {
        const newFavorites = favorites.filter(fav => fav.id !== bookId);
        wx.setStorageSync('favorites', newFavorites);
        this.setData({ isFavorite: false });
        wx.showToast({
          title: '已取消收藏（本地）',
          icon: 'success',
          duration: 1000
        });
      } else {
        favorites.push({
          id: bookId,
          title: this.data.bookInfo.title,
          cover: this.data.bookInfo.cover,
          time: new Date().toISOString()
        });
        wx.setStorageSync('favorites', favorites);
        this.setData({ isFavorite: true });
        wx.showToast({
          title: '已收藏（本地）',
          icon: 'success',
          duration: 1000
        });
      }
    }
  },

  // 🚨 新增：下载功能
  toggleDownload: async function() {
    const bookId = this.data.bookId;
    const currentStatus = this.data.isDownloaded;
    
    try {
      if (currentStatus) {
        // 移除下载
        StorageManager.removeDownload(bookId);
        this.setData({ isDownloaded: false });
        wx.showToast({
          title: '已移除下载',
          icon: 'success',
          duration: 1000
        });
      } else {
        // 添加下载
        StorageManager.addDownload(bookId);
        this.setData({ isDownloaded: true });
        
        // 开始下载书籍内容
        await this.downloadBookContent(bookId);
        
        wx.showToast({
          title: '已开始下载',
          icon: 'success',
          duration: 1000
        });
      }
    } catch (error) {
      console.error('❌ 下载操作失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none',
        duration: 1000
      });
    }
  },

  // 🚨 新增：下载书籍内容
  async downloadBookContent(bookId) {
    try {
      console.log('📥 开始下载书籍内容:', bookId);
      
      const chapters = this.data.chapters;
      const bookTitle = this.data.bookInfo.title;
      
      // 创建下载管理器（如果有的话）
      const downloadManager = getApp().globalData.downloadManager;
      if (downloadManager) {
        downloadManager.addDownloadTask({
          bookId: bookId,
          bookTitle: bookTitle,
          chapters: chapters,
          cover: this.data.bookInfo.cover
        });
      } else {
        console.log('📦 模拟下载，将音频文件添加到本地缓存');
        // 这里可以实现实际的音频文件下载逻辑
      }
      
    } catch (error) {
      console.error('❌ 下载书籍内容失败:', error);
      throw error;
    }
  },

  // ============ 页面跳转 ============
// 在 book-detail.js 中的 goToPlayer 方法 - 修复结尾
goToPlayer: function(e) {
    try {
      console.log('跳转到播放器');
      
      const bookId = this.data.bookId || '101'; // 🚨 修复：使用正确的字段名
      const chapters = this.data.chapters || [];
      let chapterId = null;
      let chapterIndex = 0;
      
      // 🚨 修复：确保有章节ID
      if (chapters.length > 0) {
        // 如果有指定章节索引
        if (e && e.currentTarget && e.currentTarget.dataset.index !== undefined) {
          chapterIndex = e.currentTarget.dataset.index;
          const chapter = chapters[chapterIndex];
          chapterId = chapter.id || chapter._id;
        } else {
          // 默认使用第一个章节
          const firstChapter = chapters[0];
          chapterId = firstChapter.id || firstChapter._id || 'C10101';
        }
      } else {
        // 如果没有章节，生成默认章节ID
        chapterId = `C${bookId}01`;
      }
      
      if (!chapterId) {
        wx.showToast({
          title: '没有找到可用章节',
          icon: 'none'
        });
        return;
      }
      
      // 🚨 使用playback-manager来管理播放状态
      const playbackManager = require('../../utils/playback-manager.js');
      
      // 获取章节标题
      const chapter = chapters[chapterIndex] || {};
      const chapterTitle = chapter.title || `第${chapterIndex + 1}章`;
      
      // 设置当前播放状态
      playbackManager.setCurrentPlay({
        bookId: bookId,
        bookTitle: this.data.bookInfo.title || '未知书籍',
        bookCover: this.data.bookInfo.cover || '/images/covers/default.jpg',
        chapterId: chapterId,
        chapterTitle: chapterTitle,
        chapterIndex: chapterIndex,
        audioUrl: chapter.audioUrl || '', // 让播放器自己生成音频URL
        progress: 0,
        duration: chapter.duration || 0,
        playbackRate: 1.0,
        volume: 0.8
      });
      
      console.log('设置播放器参数:', { 
        bookId, 
        chapterId, 
        chapterIndex,
        chapterTitle 
      });
      
      // 🚨 简化跳转参数
      wx.navigateTo({
        url: `/pages/player/player?bookId=${bookId}&chapterId=${chapterId}&chapterIndex=${chapterIndex}`,
        success: () => {
          console.log('✅ 成功跳转到播放器页面');
        },
        fail: (error) => {
          console.error('跳转到播放器失败:', error);
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    } catch (error) {
      console.error('跳转到播放器异常:', error);
      wx.showToast({
        title: '跳转失败',
        icon: 'none'
      });
    }
  }, // 🚨 这里需要逗号

  // 🚨 新增：播放书籍的第一个可用章节
  playBook: function() {
    console.log('🎵 播放书籍');
    
    const bookId = this.data.bookId;
    if (!bookId) {
      console.error('❌ 书籍ID为空');
      return;
    }
    
    // 检查是否有免费章节
    const chapters = this.data.chapters || [];
    
    if (chapters.length === 0) {
      wx.showToast({
        title: '暂无可用章节',
        icon: 'none'
      });
      return;
    }
    
    // 触发跳转到播放器
    this.goToPlayer({
      currentTarget: {
        dataset: {
          index: 0
        }
      }
    });
  },

  // 🚨 新增：播放书籍的第一个可用章节
  playBook: function() {
    console.log('🎵 播放书籍');
    
    const bookId = this.data.bookId;
    if (!bookId) {
      console.error('❌ 书籍ID为空');
      return;
    }
    
    // 检查是否有免费章节
    const chapters = this.data.chapters || [];
    let firstFreeChapterIndex = 0;
    
    if (chapters.length > 0) {
      // 寻找第一个免费章节
      for (let i = 0; i < chapters.length; i++) {
        if (chapters[i].isFree !== false) {
          firstFreeChapterIndex = i;
          break;
        }
      }
    }
    
    // 触发跳转到播放器
    this.goToPlayer({
      currentTarget: {
        dataset: {
          chapterIndex: firstFreeChapterIndex
        }
      }
    });
  },

  // 🚨 新增：播放指定章节
  playChapter: function(e) {
    const index = e.currentTarget.dataset.index;
    const chapter = this.data.chapters[index];
    
    console.log(`🎵 播放第${index + 1}章: ${chapter?.title || '未知章节'}`);
    
    if (!chapter) {
      console.error('❌ 章节不存在');
      return;
    }
    
    // 检查章节是否免费（如果有付费逻辑）
    if (chapter.isFree === false) {
      wx.showModal({
        title: '章节付费',
        content: `《${chapter.title || `第${index + 1}章`}》需要购买后才能播放`,
        confirmText: '立即购买',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.buyChapter(chapter.id || chapter._id);
          }
        }
      });
      return;
    }
    
    // 触发跳转到播放器
    this.goToPlayer({
      currentTarget: {
        dataset: {
          chapterIndex: index,
          chapterId: chapter.id || chapter._id,
          title: chapter.title || `第${index + 1}章`
        }
      }
    });
  },

  // 🚨 新增：购买章节
  buyChapter: function(chapterId) {
    console.log(`💰 购买章节: ${chapterId}`);
    wx.showToast({
      title: '购买功能开发中',
      icon: 'none',
      duration: 2000
    });
  },

  // ============ 页面控制 ============

  // 🚨 新增：返回上一页
  goBack: function() {
    wx.navigateBack();
  },

  // 🚨 新增：切换描述展开状态
  toggleDescription: function() {
    this.setData({
      expandedDescription: !this.data.expandedDescription
    });
  },

  // 🚨 新增：切换章节展开状态
  toggleChapters: function() {
    this.setData({
      showAllChapters: !this.data.showAllChapters
    });
  },

  // 🚨 新增：显示/隐藏底部工具栏
  toggleBottomBar: function() {
    this.setData({
      showBottomBar: !this.data.showBottomBar
    });
  },

  // 🚨 新增：分享功能
  onShareAppMessage: function() {
    const bookInfo = this.data.bookInfo;
    return {
      title: bookInfo.title || '英语学习有声书',
      path: `/pages/book-detail/book-detail?id=${this.data.bookId}`,
      imageUrl: bookInfo.cover || '/images/share-default.png'
    };
  },

  // 🚨 新增：显示分享面板
  showSharePanel: function() {
    this.setData({
      showSharePanel: true
    });
  },

  // 🚨 新增：隐藏分享面板
  hideSharePanel: function() {
    this.setData({
      showSharePanel: false
    });
  },

  // 🚨 新增：滚动监听
  onPageScroll: function(e) {
    const scrollTop = e.scrollTop;
    // 控制头部标题显示
    if (scrollTop > 200 && !this.data.headerTitleVisible) {
      this.setData({
        headerTitleVisible: true
      });
    } else if (scrollTop <= 200 && this.data.headerTitleVisible) {
      this.setData({
        headerTitleVisible: false
      });
    }
  },

  // ============ 生命周期 ============

  onShow: function() {
    // 检查用户登录状态变化
    const isLoggedIn = userStatus.isLoggedIn();
    const currentUserId = userStatus.getCurrentUserId();
    
    if (this.data.isLoggedIn !== isLoggedIn || this.data.currentUserId !== currentUserId) {
      console.log('登录状态变化，更新页面状态');
      this.setData({
        isLoggedIn: isLoggedIn,
        currentUserId: currentUserId
      });
      
      if (this.data.bookId) {
        if (isLoggedIn) {
          this.checkFavoriteStatus();
        } else {
          this.setData({ isFavorite: false });
        }
      }
    }
    
    if (this.data.bookId && this.data.isLoggedIn) {
      this.checkFavoriteStatus();
    }
    this.checkDownloadStatus();
  },

  onHide: function() {
    // 页面隐藏时停止音频播放
    if (this.data.audioPlaying) {
      this.stopAudioPlayback();
    }
  },

  onUnload: function() {
    // 页面卸载时清理资源
    this.cleanupResources();
  },

  // 🚨 新增：停止音频播放
  stopAudioPlayback: function() {
    try {
      const backgroundAudioManager = wx.getBackgroundAudioManager();
      if (backgroundAudioManager) {
        backgroundAudioManager.stop();
      }
      this.setData({
        audioPlaying: false,
        currentAudioId: null
      });
    } catch (error) {
      console.error('停止音频播放失败:', error);
    }
  },

  // 🚨 新增：清理资源
  cleanupResources: function() {
    // 清除定时器、监听器等
  },

  // 🚨 新增：重试加载
  retryLoad: function() {
    this.setData({
      loading: true,
      error: false,
      errorMessage: ''
    });
    this.loadBookDetail(this.data.bookId);
  },

  // 🚨 新增：查看所有评论
  viewAllComments: function() {
    wx.navigateTo({
      url: `/pages/comment/comment?bookId=${this.data.bookId}`
    });
  },

  // 🚨 新增：写评论
  writeComment: function() {
    // 检查登录状态
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/login/login?from=book_detail&bookId=${this.data.bookId}`
        });
      }, 500);
      return;
    }
    
    wx.navigateTo({
      url: `/pages/comment/write?bookId=${this.data.bookId}`
    });
  },

  // 🚨 新增：查看相似书籍详情
  viewSimilarBook: function(e) {
    const bookId = e.currentTarget.dataset.id;
    if (bookId) {
      wx.navigateTo({
        url: `/pages/book-detail/book-detail?id=${bookId}`
      });
    }
  },

  // 🚨 新增：查看作者其他作品
  viewAuthorBooks: function() {
    const author = this.data.bookInfo.author;
    if (author) {
      wx.navigateTo({
        url: `/pages/author/author?name=${encodeURIComponent(author)}`
      });
    }
  }

});
