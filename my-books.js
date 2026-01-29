// pages/my/books/my-books.js
Page({
    /**
     * 页面的初始数据
     */
    data: {
      type: 'favorites', // favorites, downloaded, completed, reading
      books: [], // 书籍列表
      isLoading: false,
      isLoadingMore: false,
      isEmpty: false,
      page: 1,
      pageSize: 20,
      hasMore: true,
      userId: null,
      userInfo: null,
      isMockData: false,
      // 书籍统计
      bookStats: {
        favorites: 0,
        downloaded: 0,
        completed: 0,
        reading: 0,
        total: 0
      }
    },
  
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function(options) {
      console.log('📖 我的书籍页面加载，参数:', options);
      
      // 获取页面类型
      const type = options.type || 'favorites';
      this.setData({ 
        type: type,
        page: 1
      });
      
      // 设置页面标题
      this.setPageTitle(type);
      
      // 获取用户信息
      this.getUserInfo();
    },
  
    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function() {
      // 刷新数据
      if (this.data.userId) {
        this.loadBooksData();
        this.loadBookStats();
      }
    },
  
    /**
     * 🚨 获取用户信息
     */
    getUserInfo: function() {
      try {
        // 尝试从全局获取
        const app = getApp();
        if (app && app.globalData.userInfo) {
          const userInfo = app.globalData.userInfo;
          this.setData({
            userId: userInfo._id || userInfo.id,
            userInfo: userInfo
          });
          this.loadBooksData();
          this.loadBookStats();
        } else {
          // 从本地存储获取
          const userInfo = wx.getStorageSync('userInfo');
          if (userInfo) {
            this.setData({
              userId: userInfo._id || userInfo.id,
              userInfo: userInfo
            });
            this.loadBooksData();
            this.loadBookStats();
          } else {
            console.log('❌ 未找到用户信息，跳转到登录页');
            setTimeout(() => {
              wx.switchTab({
                url: '/pages/my/my'
              });
            }, 1500);
          }
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
      }
    },
  
    /**
     * 🚨 设置页面标题
     */
    setPageTitle: function(type) {
      let title = '我的书籍';
      switch(type) {
        case 'favorites':
          title = '我的收藏';
          break;
        case 'downloaded':
          title = '我的下载';
          break;
        case 'completed':
          title = '已完成';
          break;
        case 'reading':
          title = '进行中';
          break;
      }
      wx.setNavigationBarTitle({ title });
    },
  
    /**
     * 🚨 加载书籍数据（从后端API）- 修正方法名
     */
    loadBooksData: function() {
      if (this.data.isLoading) return;
      
      this.setData({ 
        isLoading: true,
        isEmpty: false,
        page: 1,
        hasMore: true
      });
      
      console.log('📚 加载书籍数据，类型:', this.data.type, '用户ID:', this.data.userId);
      
      const { cloudAPI } = require('../../utils/uni-cloud.js');
      const userId = this.data.userId;
      const type = this.data.type;
      
      if (!userId || userId <= 0) {
        console.log('❌ 没有用户ID，使用模拟数据');
        this.loadMockData();
        return;
      }
      
      // 根据类型调用不同的API - 🚨 使用正确的方法名
      let apiPromise;
      
      switch(type) {
        case 'favorites':
          apiPromise = cloudAPI.book.getMyFavorites({ 
            userId: userId, 
            page: 1, 
            pageSize: this.data.pageSize 
          });
          break;
        case 'downloaded':
          apiPromise = cloudAPI.book.getMyDownloads({ 
            userId: userId, 
            page: 1, 
            pageSize: this.data.pageSize 
          });
          break;
        case 'completed':
          apiPromise = cloudAPI.book.getMyCompleted({ 
            userId: userId, 
            page: 1, 
            pageSize: this.data.pageSize 
          });
          break;
        case 'reading':
          apiPromise = cloudAPI.book.getMyInProgress({ 
            userId: userId, 
            page: 1, 
            pageSize: this.data.pageSize 
          });
          break;
        default:
          apiPromise = Promise.reject(new Error('未知的书籍类型'));
      }
      
      apiPromise
        .then(res => {
          console.log(`✅ ${type} 数据加载成功:`, res);
          
          // 处理不同的响应格式
          let bookList = [];
          let hasMore = true;
          
          if (res.code === 0 || res.success === true) {
            // 标准格式
            bookList = res.data || res.data?.list || [];
            // 检查是否有更多数据
            hasMore = bookList.length >= this.data.pageSize;
          } else if (res.list) {
            // 直接包含list的格式
            bookList = res.list || [];
            hasMore = bookList.length >= this.data.pageSize;
          } else if (res.data) {
            // 只有data的格式
            bookList = Array.isArray(res.data) ? res.data : [res.data];
            hasMore = bookList.length >= this.data.pageSize;
          } else if (Array.isArray(res)) {
            // 直接就是数组
            bookList = res;
            hasMore = res.length >= this.data.pageSize;
          }
          
          // 处理书籍数据，确保有必要的字段
          const processedBooks = this.processBooksData(bookList, type);
          
          this.setData({
            books: processedBooks,
            isEmpty: processedBooks.length === 0,
            isLoading: false,
            hasMore: hasMore,
            page: 2, // 加载下一页从第2页开始
            isMockData: false
          });
          
          if (processedBooks.length === 0) {
            this.loadMockData(); // 如果没有数据，使用模拟数据
          }
        })
        .catch(err => {
          console.error(`❌ ${type} 数据加载失败:`, err);
          this.loadMockData();
        });
    },
  
    /**
     * 🚨 处理书籍数据，统一格式
     */
    processBooksData: function(books, type) {
      if (!Array.isArray(books)) return [];
      
      return books.map((book, index) => {
        // 确保有基本的字段
        const processedBook = {
          id: book._id || book.id || index,
          title: book.title || `书籍 ${index + 1}`,
          author: book.author || '未知作者',
          cover: book.cover || '/images/book-cover.jpg',
          description: book.description || `这是第 ${index + 1} 本书的简介`,
          progress: book.progress || Math.floor(Math.random() * 100),
          totalChapters: book.totalChapters || 20,
          readChapters: book.readChapters || Math.floor(Math.random() * 20),
          lastReadTime: book.lastReadTime || '2023-01-01',
          isFavorite: book.isFavorite !== undefined ? book.isFavorite : Math.random() > 0.5,
          level: book.level || '中级',
          likeCount: book.likeCount || 0,
          recommendBadge: book.recommendBadge || '',
          categoryName: book.categoryName || '未分类'
        };
        
        // 根据类型添加特定字段
        switch(type) {
          case 'completed':
            processedBook.completedTime = book.completedTime || new Date().toISOString().split('T')[0];
            processedBook.progress = 100;
            break;
          case 'reading':
            processedBook.currentChapter = book.currentChapter || '第1章';
            processedBook.lastListenTime = book.lastListenTime || '刚刚';
            break;
          case 'downloaded':
            processedBook.downloadTime = book.downloadTime || new Date().toISOString().split('T')[0];
            processedBook.downloadSize = book.downloadSize || '12.5MB';
            break;
        }
        
        return processedBook;
      });
    },
  
    /**
     * 🚨 加载更多数据
     */
    loadMore: function() {
      if (this.data.isLoadingMore || !this.data.hasMore) return;
      
      this.setData({ isLoadingMore: true });
      
      console.log('📚 加载更多数据，类型:', this.data.type, '页码:', this.data.page);
      
      const { cloudAPI } = require('../../utils/uni-cloud.js');
      const userId = this.data.userId;
      const type = this.data.type;
      const page = this.data.page;
      
      if (!userId || userId <= 0) {
        this.setData({ isLoadingMore: false });
        return;
      }
      
      let apiPromise;
      
      switch(type) {
        case 'favorites':
          apiPromise = cloudAPI.book.getMyFavorites({ 
            userId: userId, 
            page: page, 
            pageSize: this.data.pageSize 
          });
          break;
        case 'downloaded':
          apiPromise = cloudAPI.book.getMyDownloads({ 
            userId: userId, 
            page: page, 
            pageSize: this.data.pageSize 
          });
          break;
        case 'completed':
          apiPromise = cloudAPI.book.getMyCompleted({ 
            userId: userId, 
            page: page, 
            pageSize: this.data.pageSize 
          });
          break;
        case 'reading':
          apiPromise = cloudAPI.book.getMyInProgress({ 
            userId: userId, 
            page: page, 
            pageSize: this.data.pageSize 
          });
          break;
        default:
          apiPromise = Promise.reject(new Error('未知的书籍类型'));
      }
      
      apiPromise
        .then(res => {
          console.log(`✅ ${type} 更多数据加载成功:`, res);
          
          // 处理不同的响应格式
          let bookList = [];
          
          if (res.code === 0 || res.success === true) {
            bookList = res.data || res.data?.list || [];
          } else if (res.list) {
            bookList = res.list || [];
          } else if (res.data) {
            bookList = Array.isArray(res.data) ? res.data : [res.data];
          } else if (Array.isArray(res)) {
            bookList = res;
          }
          
          // 处理书籍数据
          const processedBooks = this.processBooksData(bookList, type);
          
          // 检查是否有更多数据
          const hasMore = processedBooks.length >= this.data.pageSize;
          
          this.setData({
            books: this.data.books.concat(processedBooks),
            isLoadingMore: false,
            page: page + 1,
            hasMore: hasMore
          });
          
          // 如果加载到数据但长度不足一页，说明没有更多了
          if (processedBooks.length > 0 && processedBooks.length < this.data.pageSize) {
            this.setData({ hasMore: false });
          }
        })
        .catch(err => {
          console.error(`❌ ${type} 加载更多失败:`, err);
          this.setData({ 
            isLoadingMore: false,
            hasMore: false 
          });
        });
    },
  
    /**
     * 🚨 加载书籍统计数据
     */
    loadBookStats: function() {
      const userId = this.data.userId;
      if (!userId || userId <= 0) return;
      
      console.log('📊 加载书籍统计数据，用户ID:', userId);
      
      const { cloudAPI } = require('../../utils/uni-cloud.js');
      
      // 尝试从API获取统计数据
      cloudAPI.book.getMyAllBookStats({ userId: userId })
        .then(res => {
          console.log('📊 书籍统计数据:', res);
          
          if (res.code === 0 || res.success === true) {
            const stats = res.data || res;
            this.setData({
              bookStats: {
                favorites: stats.favorites || 0,
                downloaded: stats.downloaded || 0,
                completed: stats.completed || 0,
                reading: stats.inProgress || 0,
                total: stats.total || 0
              }
            });
            
            // 保存到本地
            wx.setStorageSync('bookStats', this.data.bookStats);
          }
        })
        .catch(err => {
          console.error('获取书籍统计失败:', err);
          
          // 尝试从本地存储获取
          const localStats = wx.getStorageSync('bookStats');
          if (localStats) {
            this.setData({ bookStats: localStats });
          }
        });
    },
  
    /**
     * 🚨 如果没有API方法，创建模拟API调用
     */
    loadMockData: function() {
      console.log('📚 使用模拟数据');
      
      // 模拟数据
      let mockBooks = [];
      const bookCount = this.data.type === 'favorites' ? 8 : 5;
      
      for (let i = 1; i <= bookCount; i++) {
        const book = {
          id: i,
          title: `${this.getTypeName(this.data.type)}书籍 ${i}`,
          author: `作者 ${i}`,
          cover: '/images/book-cover.jpg',
          description: `这是第 ${i} 本${this.getTypeName(this.data.type)}书籍的简介`,
          progress: Math.floor(Math.random() * 100),
          totalChapters: 20,
          readChapters: Math.floor(Math.random() * 20),
          lastReadTime: '2023-01-01',
          isFavorite: Math.random() > 0.5,
          level: ['初级', '中级', '高级'][Math.floor(Math.random() * 3)],
          likeCount: Math.floor(Math.random() * 1000),
          recommendBadge: Math.random() > 0.7 ? '🔥 热门' : '',
          categoryName: ['文学', '历史', '科学', '教育'][Math.floor(Math.random() * 4)]
        };
        
        // 根据类型添加特定字段
        switch(this.data.type) {
          case 'completed':
            book.completedTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            book.progress = 100;
            break;
          case 'reading':
            book.currentChapter = `第${Math.floor(Math.random() * 20) + 1}章`;
            book.lastListenTime = ['刚刚', '1小时前', '昨天', '3天前'][Math.floor(Math.random() * 4)];
            break;
          case 'downloaded':
            book.downloadTime = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            book.downloadSize = `${(Math.random() * 50 + 5).toFixed(1)}MB`;
            break;
        }
        
        mockBooks.push(book);
      }
      
      this.setData({
        books: mockBooks,
        isEmpty: false,
        isLoading: false,
        isLoadingMore: false,
        isMockData: true,
        hasMore: false
      });
    },
  
    /**
     * 🚨 获取类型名称
     */
    getTypeName: function(type) {
      switch(type) {
        case 'favorites': return '收藏';
        case 'downloaded': return '下载';
        case 'completed': return '完成';
        case 'reading': return '进行中';
        default: return '';
      }
    },
  
    /**
     * 🚨 书籍点击事件
     */
    onBookTap: function(e) {
      const bookId = e.currentTarget.dataset.id;
      const book = this.data.books.find(b => b.id === bookId);
      
      if (!book) return;
      
      console.log('📖 点击书籍:', book.title, 'ID:', bookId);
      
      // 跳转到书籍详情页
      wx.navigateTo({
        url: `/pages/book/detail/detail?id=${bookId}&title=${encodeURIComponent(book.title)}`
      });
    },
  
    /**
     * 🚨 切换分类
     */
    onTypeChange: function(e) {
      const type = e.currentTarget.dataset.type;
      if (type === this.data.type) return;
      
      console.log('🔄 切换分类:', type);
      
      this.setData({ 
        type: type,
        page: 1,
        books: [],
        hasMore: true
      });
      
      // 更新页面标题
      this.setPageTitle(type);
      
      // 加载数据
      this.loadBooksData();
    },
  
    /**
     * 🚨 下拉刷新
     */
    onPullDownRefresh: function() {
      console.log('🔄 下拉刷新');
      
      this.setData({
        page: 1,
        hasMore: true
      });
      
      this.loadBooksData();
      this.loadBookStats();
      
      // 停止下拉刷新
      setTimeout(() => {
        wx.stopPullDownRefresh();
      }, 1000);
    },
  
    /**
     * 🚨 上拉加载更多
     */
    onReachBottom: function() {
      console.log('⬇️ 上拉加载更多');
      
      if (this.data.isMockData) {
        console.log('模拟数据不加载更多');
        return;
      }
      
      this.loadMore();
    },
  
    /**
     * 🚨 分享功能
     */
    onShareAppMessage: function() {
      const typeName = this.getTypeName(this.data.type);
      
      return {
        title: `我的${typeName}书籍`,
        path: `/pages/my/books/my-books?type=${this.data.type}`
      };
    },
  
    /**
     * 🚨 返回按钮点击
     */
    onBackTap: function() {
      wx.navigateBack();
    },
  
    /**
     * 🚨 刷新按钮点击
     */
    onRefreshTap: function() {
      wx.showLoading({ title: '刷新中...' });
      
      this.loadBooksData();
      this.loadBookStats();
      
      setTimeout(() => {
        wx.hideLoading();
        wx.showToast({ title: '刷新成功', icon: 'success' });
      }, 1500);
    },
  
    /**
     * 🚨 空状态按钮点击
     */
    onEmptyButtonTap: function() {
      const type = this.data.type;
      let url = '';
      
      switch(type) {
        case 'favorites':
          url = '/pages/book/list/list?tab=recommend';
          break;
        case 'downloaded':
          url = '/pages/book/list/list';
          break;
        case 'completed':
        case 'reading':
          url = '/pages/book/list/list?tab=hot';
          break;
      }
      
      if (url) {
        wx.switchTab({
          url: url
        });
      }
    }
  });