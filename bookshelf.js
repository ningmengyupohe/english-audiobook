// pages/bookshelf/bookshelf.js - 修复版
// 🚨 正确导入方式
const { cloudAPI } = require('../../utils/uni-cloud.js')
const userStatusManager = require('../../utils/user-status.js')
const app = getApp()

Page({
  data: {
    activeTab: 'collection', // collection / history
    isEditMode: false,
    selectedBooks: [],
    isAllSelected: false,
    
    // 收藏书籍列表
    collectionList: [],
    // 历史记录列表
    historyList: [],
    
    // 当前显示的书单
    bookList: [],
    
    // 加载状态
    isLoading: false,
    hasUserInfo: false,
    userId: 0,
    
    // 分页
    collectionPage: 1,
    collectionPageSize: 20,
    collectionTotal: 0,
    collectionHasMore: true,
    
    historyPage: 1,
    historyPageSize: 20,
    historyTotal: 0,
    historyHasMore: true
  },

  onLoad: function(options) {
    console.log('书架页面加载');
    
    // 使用 userStatusManager 获取用户ID
    const userId = userStatusManager.getCurrentUserId();
    console.log('获取到的用户ID:', userId);
    
    if (userId > 0) {
      this.setData({ userId, hasUserInfo: true });
      this.loadBookshelfData();
    } else {
      // 🚨 修改：即使未登录也显示页面，只是数据为空
      this.setData({ hasUserInfo: false });
      this.setData({
        collectionList: [],
        historyList: [],
        bookList: []
      });
      
      // 显示未登录提示
      wx.showToast({
        title: '请先登录查看书架',
        icon: 'none',
        duration: 2000
      });
    }
  },

  onShow: function() {
    console.log('书架页面显示');
    
    // 检查登录状态
    const userId = userStatusManager.getCurrentUserId();
    if (this.data.userId !== userId) {
      console.log('用户ID变更，重新加载数据');
      this.setData({ userId, hasUserInfo: userId > 0 });
      this.reloadBookshelfData();
    }
  },

  /**
   * 重新加载书架数据
   */
  reloadBookshelfData: function() {
    this.setData({
      collectionList: [],
      historyList: [],
      collectionPage: 1,
      historyPage: 1,
      collectionHasMore: true,
      historyHasMore: true
    });
    
    if (this.data.userId > 0) {
      this.loadBookshelfData();
    } else {
      this.setData({
        bookList: [],
        isLoading: false
      });
    }
  },

  /**
   * 跳转到登录页面
   */
  goToLogin: function() {
    console.log('跳转到登录页面');
    
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const currentRoute = currentPage.route;
    
    wx.navigateTo({
      url: `/pages/login/login?redirect=${encodeURIComponent('/' + currentRoute)}&from=bookshelf`
    });
  },

  /**
   * 加载书架数据
   */
  loadBookshelfData: function() {
    if (this.data.userId <= 0) {
      console.log('用户未登录，不加载书架数据');
      this.setData({ 
        collectionList: [],
        historyList: [],
        bookList: [],
        isLoading: false 
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    // 并行加载收藏和历史数据
    Promise.all([
      this.loadCollections(),
      this.loadHistory()
    ]).then(() => {
      this.setData({ isLoading: false });
      this.updateBookList();
    }).catch((error) => {
      console.error('加载书架数据失败:', error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  /**
   * 加载收藏列表
   */
  loadCollections: async function() {
    try {
      const { collectionPage, collectionPageSize, userId } = this.data;
      
      console.log('开始加载收藏列表，用户ID:', userId, '页码:', collectionPage);
      
      // 🚨 修复调用方式：使用 cloudAPI.shelf 的 getUserCollections 方法
      const result = await cloudAPI.shelf.getUserCollections({
        userId: userId,
        page: collectionPage,
        pageSize: collectionPageSize
      });
      
      console.log('收藏数据响应:', result);
      
      if (result) {
        let collections = [];
        let total = 0;
        
        // 处理不同的响应格式
        if (Array.isArray(result)) {
          // 直接返回数组
          collections = result;
          total = result.length;
        } else if (result.list && Array.isArray(result.list)) {
          // 返回 {list: [], pagination: {}}
          collections = result.list;
          total = result.pagination ? result.pagination.total || 0 : collections.length;
        } else if (result.data && Array.isArray(result.data)) {
          // 返回 {code: 0, data: []} 或 {success: true, data: []}
          collections = result.data;
          total = result.total || result.pagination?.total || collections.length;
        } else {
          collections = [];
        }
        
        console.log('获取到收藏数据:', collections.length, '条');
        
        // 处理书籍数据
        const newCollections = collections.map((item, index) => {
          const book = item.bookInfo || item;
          return {
            id: item._id || `collection_${index}`,
            recordId: item._id || item.id,
            bookId: item.bookId || book._id || book.id,
            title: book.title || '未知书名',
            author: book.author || '未知作者',
            cover: book.cover || '/images/covers/default.jpg',
            duration: Math.floor((book.totalDuration || 0) / 60), // 转换为分钟
            playCount: book.playCount || 0,
            category: book.category || '未分类',
            isFavorite: true,
            progress: this.calculateBookProgress(book),
            lastPlayTime: this.formatTime(item.collectTime || Date.now()),
            bookData: book
          };
        });
        
        // 更新数据
        let updatedList = [];
        if (collectionPage === 1) {
          updatedList = newCollections;
        } else {
          updatedList = [...this.data.collectionList, ...newCollections];
        }
        
        this.setData({
          collectionList: updatedList,
          collectionTotal: total,
          collectionHasMore: newCollections.length >= collectionPageSize
        });
        
        console.log('收藏列表更新完成:', updatedList.length, '本书');
        return true;
      } else {
        console.log('未获取到收藏数据，使用空数组');
        this.setData({ 
          collectionList: [],
          collectionHasMore: false 
        });
        return true;
      }
    } catch (error) {
      console.error('加载收藏列表失败:', error);
      // 🚨 即使失败也返回成功，避免阻塞其他请求
      this.setData({ 
        collectionList: [],
        collectionHasMore: false 
      });
      return true;
    }
  },

  /**
   * 加载历史记录
   */
  loadHistory: async function() {
    try {
      const { historyPage, historyPageSize, userId } = this.data;
      
      console.log('开始加载历史记录，用户ID:', userId, '页码:', historyPage);
      
      // 🚨 修复调用方式：使用 cloudAPI.shelf 的 getUserHistory 方法
      const result = await cloudAPI.shelf.getUserHistory({
        userId: userId,
        page: historyPage,
        pageSize: historyPageSize
      });
      
      console.log('历史数据响应:', result);
      
      if (result) {
        let history = [];
        let total = 0;
        
        // 处理不同的响应格式
        if (Array.isArray(result)) {
          history = result;
          total = result.length;
        } else if (result.list && Array.isArray(result.list)) {
          history = result.list;
          total = result.pagination ? result.pagination.total || 0 : history.length;
        } else if (result.data && Array.isArray(result.data)) {
          history = result.data;
          total = result.total || result.pagination?.total || history.length;
        } else {
          history = [];
        }
        
        console.log('获取到历史数据:', history.length, '条');
        
        const newHistory = history.map((item, index) => {
          const book = item.bookInfo || {};
          const chapter = item.chapterInfo || {};
          return {
            id: item._id || `history_${index}`,
            recordId: item._id || item.id,
            bookId: book._id || book.id || item.bookId,
            title: book.title || '未知书名',
            author: book.author || '未知作者',
            cover: book.cover || '/images/covers/default.jpg',
            duration: Math.floor((chapter.duration || item.duration || 0) / 60),
            playCount: 1,
            category: book.category || '未分类',
            isFavorite: false,
            progress: this.calculateHistoryProgress(item),
            lastPlayTime: this.formatTime(item.listenTime || Date.now()),
            chapterId: item.chapterId || chapter._id || chapter.id,
            chapterTitle: chapter.title || '未知章节',
            bookData: book,
            recordData: item
          };
        });
        
        // 更新数据
        let updatedList = [];
        if (historyPage === 1) {
          updatedList = newHistory;
        } else {
          updatedList = [...this.data.historyList, ...newHistory];
        }
        
        this.setData({
          historyList: updatedList,
          historyTotal: total,
          historyHasMore: newHistory.length >= historyPageSize
        });
        
        console.log('历史记录更新完成:', updatedList.length, '条记录');
        return true;
      } else {
        console.log('未获取到历史数据，使用空数组');
        this.setData({ 
          historyList: [],
          historyHasMore: false 
        });
        return true;
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
      // 🚨 即使失败也返回成功，避免阻塞其他请求
      this.setData({ 
        historyList: [],
        historyHasMore: false 
      });
      return true;
    }
  },

  /**
   * 计算书籍进度
   */
  calculateBookProgress: function(book) {
    if (!book.totalChapters || !book.completedChapters) {
      return 0;
    }
    
    return Math.round((book.completedChapters / book.totalChapters) * 100);
  },

  /**
   * 计算历史记录进度
   */
  calculateHistoryProgress: function(record) {
    if (!record.duration || !record.progress) {
      return 0;
    }
    
    return Math.round((record.progress / record.duration) * 100);
  },

  /**
   * 格式化时间
   */
  formatTime: function(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    
    // 如果是今天
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    // 如果是昨天
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    // 其他时间
    return date.toLocaleDateString('zh-CN');
  },

  /**
   * 更新显示的书单
   */
  updateBookList: function() {
    const { activeTab, collectionList, historyList } = this.data;
    
    console.log('更新书单，当前选项卡:', activeTab);
    console.log('收藏列表:', collectionList.length);
    console.log('历史列表:', historyList.length);
    
    if (activeTab === 'collection') {
      this.setData({ bookList: collectionList });
    } else {
      this.setData({ bookList: historyList });
    }
    
    console.log('当前书单:', this.data.bookList.length, '个项目');
  },

  /**
   * 切换选项卡
   */
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    console.log('切换选项卡到:', tab);
    
    this.setData({
      activeTab: tab,
      isEditMode: false,
      selectedBooks: [],
      isAllSelected: false
    });
    
    this.updateBookList();
  },

  /**
   * 切换编辑模式
   */
  toggleEditMode: function() {
    const newMode = !this.data.isEditMode;
    console.log('切换编辑模式:', newMode);
    
    this.setData({
      isEditMode: newMode,
      selectedBooks: newMode ? [] : this.data.selectedBooks,
      isAllSelected: false
    });
  },

  /**
   * 切换选择状态
   */
  toggleSelect: function(e) {
    const bookId = e.currentTarget.dataset.id;
    let selectedBooks = [...this.data.selectedBooks];
    
    if (selectedBooks.includes(bookId)) {
      selectedBooks = selectedBooks.filter(id => id !== bookId);
    } else {
      selectedBooks.push(bookId);
    }
    
    const isAllSelected = selectedBooks.length === this.data.bookList.length;
    
    this.setData({
      selectedBooks,
      isAllSelected
    });
  },

  /**
   * 全选/取消全选
   */
  selectAll: function() {
    const { bookList, isAllSelected } = this.data;
    
    if (isAllSelected) {
      // 取消全选
      this.setData({
        selectedBooks: [],
        isAllSelected: false
      });
    } else {
      // 全选
      const allIds = bookList.map(book => book.id);
      this.setData({
        selectedBooks: allIds,
        isAllSelected: true
      });
    }
  },

  /**
   * 批量删除
   */
  batchDelete: function() {
    if (this.data.selectedBooks.length === 0) {
      wx.showToast({
        title: '请选择要删除的项目',
        icon: 'none'
      });
      return;
    }
    
    const actionName = this.data.activeTab === 'collection' ? '删除收藏' : '删除历史记录';
    
    wx.showModal({
      title: '确认删除',
      content: `确定要${actionName}选中的 ${this.data.selectedBooks.length} 个项目吗？`,
      success: (res) => {
        if (res.confirm) {
          this.deleteSelectedBooks();
        }
      }
    });
  },

  /**
   * 删除选中的书籍
   */
  deleteSelectedBooks: async function() {
    try {
      const { activeTab, selectedBooks, userId, bookList } = this.data;
      
      wx.showLoading({
        title: '删除中...',
        mask: true
      });
      
      // 获取要删除的记录信息
      const recordsToDelete = bookList.filter(book => selectedBooks.includes(book.id));
      
      const deletePromises = recordsToDelete.map(record => {
        if (activeTab === 'collection') {
          // 删除收藏记录
          return cloudAPI.shelf.removeFromCollection({
            userId: userId,
            bookId: record.bookId,
            recordId: record.recordId
          });
        } else {
          // 删除历史记录
          return cloudAPI.shelf.deleteHistoryRecord({
            userId: userId,
            recordId: record.recordId
          });
        }
      });
      
      await Promise.all(deletePromises);
      
      // 更新本地数据
      if (activeTab === 'collection') {
        const newCollectionList = this.data.collectionList.filter(book => 
          !selectedBooks.includes(book.id)
        );
        this.setData({ collectionList: newCollectionList });
      } else {
        const newHistoryList = this.data.historyList.filter(record => 
          !selectedBooks.includes(record.id)
        );
        this.setData({ historyList: newHistoryList });
      }
      
      // 更新显示的书单
      this.updateBookList();
      
      // 重置编辑状态
      this.setData({
        isEditMode: false,
        selectedBooks: [],
        isAllSelected: false
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      
    } catch (error) {
      console.error('删除失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  },

  /**
   * 加载更多（下拉刷新）
   */
  onReachBottom: function() {
    const { activeTab, isLoading } = this.data;
    
    if (isLoading) return;
    
    if (activeTab === 'collection') {
      if (this.data.collectionHasMore) {
        this.setData({
          collectionPage: this.data.collectionPage + 1
        }, () => {
          this.loadCollections().then(() => {
            this.updateBookList();
          });
        });
      }
    } else {
      if (this.data.historyHasMore) {
        this.setData({
          historyPage: this.data.historyPage + 1
        }, () => {
          this.loadHistory().then(() => {
            this.updateBookList();
          });
        });
      }
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function() {
    console.log('下拉刷新');
    
    this.setData({
      collectionPage: 1,
      historyPage: 1,
      collectionHasMore: true,
      historyHasMore: true
    });
    
    this.loadBookshelfData().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 跳转到搜索
   */
  goToSearch: function() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  /**
   * 跳转到书籍详情
   */
  goToBookDetail: function(e) {
    const bookId = e.currentTarget.dataset.bookid || e.currentTarget.dataset.id;
    const book = this.data.bookList.find(b => b.id === e.currentTarget.dataset.id);
    
    console.log('跳转到书籍详情，bookId:', bookId, 'book:', book);
    
    if (bookId) {
      wx.navigateTo({
        url: `/pages/book-detail/book-detail?id=${bookId}`
      });
    } else if (book && book.bookId) {
      wx.navigateTo({
        url: `/pages/book-detail/book-detail?id=${book.bookId}`
      });
    }
  },

  /**
   * 切换收藏状态
   */
  toggleFavorite: async function(e) {
    const bookId = e.currentTarget.dataset.id;
    const book = this.data.bookList.find(b => b.id === bookId);
    
    if (!book || this.data.userId <= 0) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    try {
      if (book.isFavorite) {
        // 取消收藏
        const result = await cloudAPI.shelf.removeFromCollection({
          userId: this.data.userId,
          bookId: book.bookId,
          recordId: book.recordId
        });
        
        wx.showToast({
          title: '已取消收藏',
          icon: 'success'
        });
      } else {
        // 添加收藏
        const result = await cloudAPI.shelf.addToCollection({
          userId: this.data.userId,
          bookId: book.bookId
        });
        
        wx.showToast({
          title: '已添加收藏',
          icon: 'success'
        });
      }
      
      // 更新本地数据
      const newBookList = this.data.bookList.map(b => {
        if (b.id === bookId) {
          return { ...b, isFavorite: !b.isFavorite };
        }
        return b;
      });
      
      // 根据当前选项卡更新对应的列表
      if (this.data.activeTab === 'collection') {
        // 如果是收藏页面，移除该条记录
        const newCollectionList = this.data.collectionList.filter(b => b.id !== bookId);
        this.setData({ collectionList: newCollectionList });
      } else {
        // 如果是历史页面，只更新收藏状态
        const newHistoryList = this.data.historyList.map(b => {
          if (b.id === bookId) {
            return { ...b, isFavorite: !b.isFavorite };
          }
          return b;
        });
        this.setData({ historyList: newHistoryList });
      }
      
      this.setData({ bookList: newBookList });
      
    } catch (error) {
      console.error('切换收藏状态失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  /**
   * 继续播放
   */
  continuePlay: function(e) {
    const bookId = e.currentTarget.dataset.id;
    const record = this.data.bookList.find(b => b.id === bookId);
    
    if (record && record.chapterId) {
      wx.navigateTo({
        url: `/pages/player/player?chapterId=${record.chapterId}`
      });
    } else if (record && record.bookId) {
      // 如果没有章节信息，跳转到书籍详情
      wx.navigateTo({
        url: `/pages/book-detail/book-detail?id=${record.bookId}`
      });
    }
  },

  /**
   * 显示操作菜单
   */
  showActionSheet: function(e) {
    const bookId = e.currentTarget.dataset.id;
    const book = this.data.bookList.find(b => b.id === bookId);
    
    if (!book) return;
    
    const items = book.isFavorite ? ['取消收藏', '删除记录'] : ['加入收藏', '删除记录'];
    
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const tapIndex = res.tapIndex;
        if (book.isFavorite) {
          if (tapIndex === 0) {
            this.toggleFavorite(e);
          } else if (tapIndex === 1) {
            this.deleteBook(bookId);
          }
        } else {
          if (tapIndex === 0) {
            this.toggleFavorite(e);
          } else if (tapIndex === 1) {
            this.deleteBook(bookId);
          }
        }
      }
    });
  },

  /**
   * 删除单本书籍记录
   */
  deleteBook: async function(bookId) {
    try {
      const { activeTab, userId } = this.data;
      const book = this.data.bookList.find(b => b.id === bookId);
      
      if (!book) return;
      
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这条记录吗？',
        success: async (res) => {
          if (res.confirm) {
            wx.showLoading({
              title: '删除中...',
              mask: true
            });
            
            try {
              if (activeTab === 'collection') {
                // 删除收藏记录
                const result = await cloudAPI.shelf.removeFromCollection({
                  userId: userId,
                  bookId: book.bookId,
                  recordId: book.recordId
                });
                
                // 更新本地数据
                const newCollectionList = this.data.collectionList.filter(b => b.id !== bookId);
                this.setData({ collectionList: newCollectionList });
              } else {
                // 删除历史记录
                const result = await cloudAPI.shelf.deleteHistoryRecord({
                  userId: userId,
                  recordId: book.recordId
                });
                
                // 更新本地数据
                const newHistoryList = this.data.historyList.filter(b => b.id !== bookId);
                this.setData({ historyList: newHistoryList });
              }
              
              // 更新显示的书单
              this.updateBookList();
              
              wx.hideLoading();
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              
            } catch (error) {
              console.error('删除失败:', error);
              wx.hideLoading();
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            }
          }
        }
      });
    } catch (error) {
      console.error('删除操作失败:', error);
    }
  },

  /**
   * 跳转到首页
   */
  goToHome: function() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  },

  /**
   * 检查书籍是否在收藏中
   */
  checkBookInCollection: async function(bookId) {
    if (!bookId || this.data.userId <= 0) return false;
    
    try {
      const result = await cloudAPI.shelf.checkInShelf({
        userId: this.data.userId,
        bookId: bookId
      });
      
      return result && result.inShelf;
    } catch (error) {
      console.error('检查收藏状态失败:', error);
      return false;
    }
  }
});