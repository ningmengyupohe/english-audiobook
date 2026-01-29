// category.js
// 导入云函数工具
const { callCloud, cloudAPI } = require('../../utils/uni-cloud');

Page({
  data: {
    categories: [],
    featuredBooks: [],
    searchKeyword: '',
    searchResults: [],
    showSearchResults: false,
    originalCategories: [],
    theme: {
      primary: '#1976D2',
      secondary: '#42A5F5',
      light: '#BBDEFB',
      lighter: '#E3F2FD'
    },
    isLoading: false,
    loadError: false,
    errorMessage: '',
    pagination: {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1
    },
    totalBookCount: 0,
    lastSyncTime: null,
    useDefaultData: false,
    databaseEmpty: false,
    connectionError: false,
    
    // 搜索相关状态
    isSearching: false,
    searchPlaceholder: '搜索分类或书籍...',
    showSearchTips: false,
    searchHistory: [],
    searchSuggestions: [],
    searchFocus: false
  },

  onLoad: async function() {
    console.log('分类页面加载 - 开始');
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    try {
      this.setData({
        isLoading: true,
        categories: [],
        loadError: false,
        databaseEmpty: false,
        useDefaultData: false,
        connectionError: false
      });
      
      // 加载搜索历史
      this.loadSearchHistory();
      
      await this.initPageData();
      
    } catch (error) {
      console.error('页面加载异常:', error);
      this.setDefaultData();
    } finally {
      wx.hideLoading();
    }
  },

  onShow: function() {
    this.refreshHotData();
  },

  onPullDownRefresh: function() {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onShareAppMessage: function() {
    return {
      title: '英语听书 - 发现有趣分类',
      path: '/pages/category/category',
      imageUrl: '/images/share/categories.jpg'
    };
  },

  onShareTimeline: function() {
    return {
      title: '英语听书 - 全部分类',
      query: '',
      imageUrl: '/images/share/categories.jpg'
    };
  },

  onUnload: function() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    if (this.searchHighlightTimer) {
      clearTimeout(this.searchHighlightTimer);
    }
  },

// category.js
// ============ 搜索功能 ============

// 搜索输入框点击事件 - 新增：直接跳转到搜索页面
onSearchTap: function() {
    console.log('搜索框被点击，跳转到搜索页面');
    
    // 跳转到搜索页面
    wx.navigateTo({
      url: '/pages/search/search',
      success: () => {
        console.log('成功跳转到搜索页面');
      },
      fail: (error) => {
        console.error('跳转到搜索页面失败:', error);
        wx.showToast({
          title: '跳转失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  
  // 搜索输入 - 修改：跳转到搜索页面
  onSearchInput: function(e) {
    const keyword = e.detail.value.trim();
    this.setData({
      searchKeyword: keyword
    });
    
    // 清空之前的计时器
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    
    // 如果关键字为空，不进行跳转
    if (!keyword) {
      this.clearSearch();
      return;
    }
    
    // 显示搜索提示
    this.setData({
      showSearchTips: true,
      searchSuggestions: this.generateSearchSuggestions(keyword)
    });
    
    // 延迟跳转，避免频繁跳转
    this.searchTimer = setTimeout(() => {
      // 跳转到搜索页面并携带关键词
      this.goToSearchPage(keyword);
    }, 800);
  },
  
  // 确认搜索（键盘上的搜索按钮） - 修改：跳转到搜索页面
  onSearchConfirm: function(e) {
    const keyword = e.detail.value.trim();
    if (!keyword) return;
    
    this.setData({
      searchKeyword: keyword,
      showSearchTips: false
    });
    
    // 跳转到搜索页面
    this.goToSearchPage(keyword);
  },
  
  // 搜索按钮点击 - 修改：跳转到搜索页面
  onSearchButtonTap: function() {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索内容',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    this.setData({
      showSearchTips: false
    });
    
    // 跳转到搜索页面
    this.goToSearchPage(keyword);
  },
  
  // 新增：跳转到搜索页面函数
  goToSearchPage: function(keyword) {
    console.log('跳转到搜索页面，关键词:', keyword);
    
    // 保存搜索历史
    this.saveSearchHistory(keyword);
    
    // 跳转到搜索页面
    wx.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(keyword)}`,
      success: () => {
        // 清空当前页面的搜索关键词
        this.setData({
          searchKeyword: '',
          showSearchTips: false,
          searchSuggestions: []
        });
      },
      fail: (error) => {
        console.error('跳转到搜索页面失败:', error);
        wx.showToast({
          title: '跳转失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  
  // 搜索建议点击 - 修改：跳转到搜索页面
  onSuggestionTap: function(e) {
    const keyword = e.currentTarget.dataset.keyword;
    if (!keyword) return;
    
    this.setData({
      searchKeyword: keyword,
      showSearchTips: false
    });
    
    // 跳转到搜索页面
    this.goToSearchPage(keyword);
  },
  
  // 历史记录点击 - 修改：跳转到搜索页面
  onHistoryTap: function(e) {
    const keyword = e.currentTarget.dataset.keyword;
    if (!keyword) return;
    
    this.setData({
      searchKeyword: keyword,
      showSearchTips: false
    });
    
    // 跳转到搜索页面
    this.goToSearchPage(keyword);
  },
  
  // 清空搜索 - 保持不变
  clearSearch: function() {
    this.setData({
      searchKeyword: '',
      categories: this.data.originalCategories,
      showSearchResults: false,
      searchResults: [],
      showSearchTips: false,
      searchSuggestions: []
    });
  },
  
  // 生成搜索建议 - 保持不变
  generateSearchSuggestions(keyword) {
    if (!keyword || keyword.length < 2) return [];
    
    const suggestions = [];
    const categories = this.data.originalCategories;
    
    // 1. 分类名称匹配
    categories.forEach(category => {
      if (category.name && category.name.includes(keyword)) {
        suggestions.push({
          type: '分类',
          keyword: category.name,
          icon: '📁'
        });
      }
    });
    
    // 2. 英文名称匹配
    categories.forEach(category => {
      if (category.enName && category.enName.toLowerCase().includes(keyword.toLowerCase())) {
        suggestions.push({
          type: '英文',
          keyword: category.enName,
          icon: '🔤'
        });
      }
    });
    
    // 3. 难度匹配
    const difficultyMatch = ['初级', '中级', '高级', '入门', '进阶', '专业'].find(d => d.includes(keyword));
    if (difficultyMatch) {
      suggestions.push({
        type: '难度',
        keyword: difficultyMatch,
        icon: '📊'
      });
    }
    
    // 去重并限制数量
    const uniqueSuggestions = suggestions.filter((item, index, self) =>
      index === self.findIndex(t => t.keyword === item.keyword)
    ).slice(0, 5);
    
    return uniqueSuggestions;
  },
  
  // 保存搜索历史 - 保持不变
  saveSearchHistory(keyword) {
    if (!keyword || keyword.trim() === '') return;
    
    try {
      let history = wx.getStorageSync('searchHistory') || [];
      
      // 移除重复的
      history = history.filter(item => item !== keyword);
      
      // 添加到开头
      history.unshift(keyword);
      
      // 限制数量
      if (history.length > 10) {
        history = history.slice(0, 10);
      }
      
      wx.setStorageSync('searchHistory', history);
      
      this.setData({
        searchHistory: history
      });
      
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  },
  
  // 加载搜索历史 - 保持不变
  loadSearchHistory() {
    try {
      const history = wx.getStorageSync('searchHistory') || [];
      this.setData({
        searchHistory: history
      });
    } catch (error) {
      console.error('加载搜索历史失败:', error);
    }
  },
  
  // 清空搜索历史 - 保持不变
  clearSearchHistory: function() {
    wx.setStorageSync('searchHistory', []);
    this.setData({
      searchHistory: []
    });
    
    wx.showToast({
      title: '搜索历史已清空',
      icon: 'success',
      duration: 1500
    });
  },
  
  // 底部提示跳转到搜索 - 保持不变
  goToSearch: function() {
    // 直接跳转到搜索页面
    this.onSearchTap();
  },
  // ============ 数据加载函数 ============

  async initPageData() {
    console.log('🚀 ========== initPageData 开始 ==========');
    
    try {
      this.setData({
        isLoading: true,
        categories: [],
        featuredBooks: [],
        loadError: false,
        lastSyncTime: '正在加载...',
        useDefaultData: false,
        databaseEmpty: false,
        connectionError: false
      });
      
      // 测试云函数连接
      const connected = await this.testConnection();
      
      if (!connected) {
        this.setData({
          connectionError: true,
          errorMessage: '网络连接失败，请检查网络后重试'
        });
        throw new Error('云函数连接失败');
      }
      
      console.log('✅ 云函数连接成功');
      
      // 加载分类数据
      console.log('📋 开始加载分类数据...');
      const categories = await this.loadCategories();
      
      console.log('📋 分类数据加载结果', {
        categoriesCount: categories?.length || 0,
        hasCategories: !!categories && categories.length > 0
      });
      
      // 数据库为空时不使用默认数据，而是显示空状态
      if (!categories || categories.length === 0) {
        console.warn('⚠️ 数据库分类数据为空，显示空状态');
        this.setData({
          isLoading: false,
          lastSyncTime: this.formatTime(new Date()) + ' (数据库空)',
          loadError: false,
          databaseEmpty: true,
          connectionError: false
        });
        
        wx.showToast({
          title: '暂无分类数据',
          icon: 'none',
          duration: 2000
        });
        
        return;
      }
      
      // 加载推荐书籍
      console.log('📋 开始加载推荐书籍...');
      const featuredBooks = await this.loadFeaturedBooks();
      
      console.log('📋 推荐书籍加载结果', {
        featuredBooksCount: featuredBooks?.length || 0
      });
      
      // 计算总书籍数量
      this.calculateTotalBookCount();
      
      this.setData({
        isLoading: false,
        lastSyncTime: this.formatTime(new Date()),
        loadError: false,
        databaseEmpty: false,
        connectionError: false,
        featuredBooks: featuredBooks || []
      });
      
      console.log('✅ 页面初始化完成');
      
    } catch (error) {
      console.error('❌ 初始化页面数据失败:', error);
      
      // 区分连接错误和数据库空
      if (this.data.connectionError) {
        console.log('网络连接失败，使用默认数据');
        this.setDefaultData();
      } else {
        // 其他错误也使用默认数据
        this.setDefaultData();
      }
    }
  },

  async testConnection() {
    try {
      console.log('📡 测试云函数连接...');
      
      const result = await callCloud('book-service', {
        action: 'test',
        message: '分类页面测试连接'
      });
      
      console.log('📡 云函数连接测试响应:', result);
      
      // 检查顶层的 success 和 code
      if (result && (result.success === true || result.code === 0)) {
        console.log('✅ 云函数连接成功 (顶层判断)');
        return true;
      }
      
      // 检查 data 对象是否有连接信息
      if (result && result.data) {
        const data = result.data;
        if (data.timestamp || data.serverTime || data.version) {
          console.log('✅ 云函数连接成功 (data判断)');
          return true;
        }
      }
      
      // 简化判断，只要没有错误信息就认为成功
      if (result && !result.error && result.message !== '请先登录') {
        console.log('✅ 云函数连接成功 (简化判断)');
        return true;
      }
      
      console.log('❌ 云函数连接测试返回失败:', result);
      return false;
      
    } catch (error) {
      console.error('❌ 云函数连接测试异常:', error);
      return false;
    }
  },

  async loadCategories() {
    console.log('🚨 ========== 开始加载分类数据 ==========');
    
    try {
      console.log('📡 调用 callCloud 函数...');
      
      const startTime = Date.now();
      
      // 使用实时统计接口
      const result = await callCloud('book-service', {
        action: 'getRealTimeBookCounts',
        withCategories: true
      });
      
      const endTime = Date.now();
      console.log(`⏱️ 请求耗时: ${endTime - startTime}ms`);
      
      console.log('📡 返回的数据:', result);
      
      if (!result) {
        console.error('❌ 云函数返回结果为 null 或 undefined');
        return [];
      }
      
      // 解析数据
      let categoriesList = [];
      let totalBookCount = 0;
      
      // 新的数据结构
      if (result.categories && Array.isArray(result.categories)) {
        categoriesList = result.categories;
        totalBookCount = result.totalBooks || 0;
        console.log(`✅ 获取到 ${categoriesList.length} 个分类，总书籍数: ${totalBookCount}`);
      }
      // 旧的数据结构
      else if (result.list && Array.isArray(result.list)) {
        categoriesList = result.list;
        totalBookCount = result.totalBooks || 0;
        console.log(`✅ 获取到 ${categoriesList.length} 个分类，总书籍数: ${totalBookCount}`);
      }
      // 如果是数组直接使用
      else if (Array.isArray(result)) {
        categoriesList = result;
        console.log(`✅ 直接是数组，获取到 ${categoriesList.length} 个分类`);
      }
      else {
        console.warn('⚠️ 未知的数据结构:', result);
      }
      
      if (categoriesList.length > 0) {
        // 格式化数据
        const categories = this.formatCategories(categoriesList);
        
        // 如果没有总数，本地计算
        if (totalBookCount === 0) {
          totalBookCount = categories.reduce((sum, cat) => sum + (cat.bookCount || 0), 0);
          console.log(`📊 本地计算总书籍数: ${totalBookCount}`);
        }
        
        // 更新页面数据
        this.setData({
          categories: categories,
          originalCategories: categories,
          totalBookCount: totalBookCount
        });
        
        console.log('✅ 数据设置成功');
        return categories;
      } else {
        console.warn('⚠️ 分类列表为空');
        return [];
      }
      
    } catch (error) {
      console.error('❌ 加载分类数据失败:', error);
      console.error('❌ 错误详情:', error.message);
      return [];
    } finally {
      console.log('🚨 ========== 结束加载分类数据 ==========');
    }
  },

  async loadFeaturedBooks() {
    try {
      console.log('开始加载推荐书籍...');
      
      const result = await callCloud('book-service', {
        action: 'getHotBooks',
        limit: 3
      });
      
      console.log('推荐书籍数据响应:', result);
      
      if (result && result.success === true) {
        let books = result.data || [];
        
        console.log('处理后的书籍数据:', books);
        
        // 如果没有书籍数据，返回空数组
        if (books.length === 0) {
          console.log('没有书籍数据');
          return [];
        }
        
        const featuredBooks = books.map(book => {
          let categoryName = '未知分类';
          let categoryColor = this.data.theme.primary;
          
          // 尝试从当前分类数据中查找分类信息
          if (book.categoryId && this.data.categories.length > 0) {
            const category = this.data.categories.find(cat => cat.id === book.categoryId);
            if (category) {
              categoryName = category.name;
              categoryColor = category.categoryColor;
            }
          }
          
          return {
            id: book._id || book.id || String(Math.random()),
            _id: book._id,
            title: book.title || '未命名',
            author: book.author || '未知作者',
            cover: book.cover || '/images/covers/default.jpg',
            description: book.description || '暂无描述',
            level: book.level || '中级',
            category: categoryName,
            rating: 4.5,
            categoryColor: categoryColor,
            recommendBadge: book.recommendBadge || '',
            likeCount: book.likeCount || 0,
            totalChapters: book.totalChapters || 0
          };
        });
        
        return featuredBooks;
      }
      
      return [];
      
    } catch (error) {
      console.error('加载推荐书籍失败:', error);
      return [];
    }
  },

  // 格式化分类数据
  formatCategories(categoriesList) {
    if (!Array.isArray(categoriesList)) {
      return [];
    }
    
    return categoriesList.map((category, index) => {
      const categoryId = category._id || category.id || String(Date.now() + index);
      
      return {
        id: categoryId,
        _id: categoryId,
        name: category.name || '未命名',
        enName: category.enName || category.name || 'Unknown',
        icon: category.icon || '/images/icons/default.png',
        gradient: category.gradient || this.getDefaultGradient(index),
        categoryColor: category.categoryColor || this.getDefaultColor(index),
        bookCount: category.bookCount || 0,
        difficulty: category.difficulty || '中等',
        bgImage: category.bgImage || this.getDefaultBgImage(index),
        showHint: false,
        isHovering: false,
        animationData: null,
        emoji: this.getEmojiForCategory(index),
        isHot: category.isHot || false,
        isRecommend: category.isRecommend || false,
        description: category.description || '',
        createTime: category.createTime
      };
    });
  },

  // 格式化书籍数据
  formatBooks(books) {
    if (!Array.isArray(books)) return [];
    
    return books.map(book => {
      const totalDuration = book.totalDuration || 0;
      const durationMinutes = Math.floor(totalDuration / 60);
      
      return {
        id: book._id || book.id || String(Math.random()),
        _id: book._id,
        title: book.title || '未命名书籍',
        author: book.author || '未知作者',
        cover: book.cover || '/images/covers/default.jpg',
        description: book.description || '暂无简介',
        level: book.level || '中级',
        totalChapters: book.totalChapters || 0,
        totalDuration: totalDuration,
        duration: durationMinutes,
        likeCount: book.likeCount || 0,
        commentCount: book.commentCount || 0,
        status: book.status || '完结',
        popularity: book.popularity || 0,
        isRecommend: book.isRecommend || false,
        recommendBadge: book.recommendBadge || '',
        recommendReason: book.recommendReason || '',
        recommendType: book.recommendType || [],
        createTime: book.createTime
      };
    });
  },

  // 计算总书籍数量
  calculateTotalBookCount() {
    const total = this.data.categories.reduce((sum, category) => {
      return sum + (category.bookCount || 0);
    }, 0);
    
    this.setData({
      totalBookCount: total
    });
    
    console.log('📊 计算总书籍数量:', total);
    return total;
  },

  // 格式化时间
  formatTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  },

  // 刷新数据
  async refreshData() {
    try {
      this.setData({
        lastSyncTime: '正在刷新...',
        databaseEmpty: false,
        connectionError: false
      });
      
      // 重新测试连接
      const connected = await this.testConnection();
      
      if (!connected) {
        this.setData({
          lastSyncTime: '网络连接失败',
          connectionError: true,
          errorMessage: '网络连接失败，请检查网络后重试'
        });
        throw new Error('网络连接失败');
      }
      
      // 重新加载数据
      const [categories, featuredBooks] = await Promise.all([
        this.loadCategories(),
        this.loadFeaturedBooks()
      ]);
      
      // 处理空数据情况
      if (!categories || categories.length === 0) {
        this.setData({
          lastSyncTime: this.formatTime(new Date()) + ' (数据库空)',
          useDefaultData: false,
          databaseEmpty: true,
          featuredBooks: featuredBooks || []
        });
        
        wx.showToast({
          title: '暂无分类数据',
          icon: 'none',
          duration: 2000
        });
        
        return;
      }
      
      this.calculateTotalBookCount();
      
      this.setData({
        lastSyncTime: this.formatTime(new Date()),
        useDefaultData: false,
        databaseEmpty: false,
        connectionError: false,
        featuredBooks: featuredBooks || []
      });
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      console.error('刷新数据失败:', error);
      this.setData({
        lastSyncTime: '同步失败'
      });
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 刷新热门数据
  async refreshHotData() {
    try {
      const featuredBooks = await this.loadFeaturedBooks();
      this.setData({
        featuredBooks: featuredBooks || []
      });
    } catch (error) {
      console.error('刷新热门数据失败:', error);
    }
  },

  // 手动同步数据
  syncData: function() {
    wx.showLoading({
      title: '刷新数据中...',
      mask: true
    });
    
    setTimeout(() => {
      this.refreshData();
      wx.hideLoading();
    }, 500);
  },

  // ============ 页面导航功能 ============

  // 跳转到搜索栏
  goToSearch: function() {
    this.setData({
      searchFocus: true
    });
    
    setTimeout(() => {
      this.setData({
        searchFocus: false
      });
    }, 1500);
    
    wx.showToast({
      title: '请在搜索栏输入关键词',
      icon: 'none',
      duration: 2000
    });
  },

  // 跳转到分类列表页面
  goToCategoryList: function(e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categories.find(item => item.id === categoryId);
    
    if (!category) {
      wx.showToast({
        title: '分类信息错误',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/category-list/category-list?categoryId=${categoryId}&categoryName=${encodeURIComponent(category.name)}&bookCount=${category.bookCount || 0}`
    });
  },

  // 跳转到推荐更多
  goToFeatured: function() {
    wx.navigateTo({
      url: '/pages/featured/featured'
    });
  },

  // 跳转到书籍详情
  goToBookDetail: function(e) {
    const bookId = e.currentTarget.dataset.id;
    if (!bookId) return;
    
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${bookId}`
    });
  },

  // 随机推荐
  randomRecommend: function() {
    if (this.data.categories.length === 0) {
      wx.showToast({
        title: '暂无分类数据',
        icon: 'none'
      });
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * this.data.categories.length);
    const randomCategory = this.data.categories[randomIndex];
    
    wx.showToast({
      title: `即将进入：${randomCategory.name}`,
      icon: 'none',
      duration: 1500
    });
    
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/category-list/category-list?categoryId=${randomCategory.id}&categoryName=${encodeURIComponent(randomCategory.name)}&bookCount=${randomCategory.bookCount || 0}`
      });
    }, 1500);
  },

  // 重试加载
  retryLoad: function() {
    this.setData({
      loadError: false,
      errorMessage: '',
      databaseEmpty: false,
      useDefaultData: false,
      connectionError: false
    });
    
    wx.showLoading({
      title: '重新加载中...',
      mask: true
    });
    
    setTimeout(async () => {
      try {
        await this.initPageData();
      } catch (error) {
        console.error('重新加载失败:', error);
      } finally {
        wx.hideLoading();
      }
    }, 300);
  },

  // 强制显示默认数据
  forceShowDefaultData: function() {
    console.log('强制显示默认数据');
    wx.showLoading({
      title: '加载默认数据...',
      mask: true
    });
    
    setTimeout(() => {
      this.setDefaultData();
      wx.hideLoading();
      wx.showToast({
        title: '已加载默认数据',
        icon: 'success',
        duration: 1500
      });
    }, 500);
  },

  // ============ 默认数据函数 ============

  setDefaultData: function() {
    console.log('设置默认分类数据（连接失败降级方案）');
    
    const defaultCategories = [
      {
        id: '1',
        name: '历史人文',
        enName: 'History & Humanities',
        bookCount: 128,
        difficulty: '中等',
        isHot: true,
        isRecommend: true,
        description: '探索人类文明发展，了解历史事件与人物传记'
      },
      {
        id: '2',
        name: '儿童教育',
        enName: 'Kids Education',
        bookCount: 96,
        difficulty: '简单',
        isHot: true,
        isRecommend: true,
        description: '儿童启蒙教育，培养学习兴趣与习惯'
      },
      {
        id: '3',
        name: '家庭生活',
        enName: 'Family Life',
        bookCount: 112,
        difficulty: '简单',
        isHot: false,
        isRecommend: true,
        description: '家庭关系、生活技巧、健康养生'
      },
      {
        id: '4',
        name: '文学经典',
        enName: 'Literature Classics',
        bookCount: 156,
        difficulty: '中等',
        isHot: true,
        isRecommend: true,
        description: '中外文学名著，小说散文诗歌'
      },
      {
        id: '5',
        name: '职场技能',
        enName: 'Career Skills',
        bookCount: 88,
        difficulty: '中等',
        isHot: true,
        isRecommend: false,
        description: '职业发展、管理技能、办公效率'
      },
      {
        id: '6',
        name: '科技科普',
        enName: 'Science & Technology',
        bookCount: 75,
        difficulty: '较难',
        isHot: false,
        isRecommend: true,
        description: '自然科学、科技前沿、科普读物'
      },
      {
        id: '7',
        name: '旅游文化',
        enName: 'Travel & Culture',
        bookCount: 64,
        difficulty: '简单',
        isHot: true,
        isRecommend: false,
        description: '世界风光、地理知识、旅行指南'
      },
      {
        id: '8',
        name: '财经商业',
        enName: 'Finance & Business',
        bookCount: 92,
        difficulty: '较难',
        isHot: true,
        isRecommend: true,
        description: '经济金融、商业管理、投资理财'
      }
    ];

    const formattedCategories = defaultCategories.map((cat, index) => ({
      ...cat,
      icon: '/images/icons/default.png',
      gradient: this.getDefaultGradient(index),
      categoryColor: this.getDefaultColor(index),
      bgImage: this.getDefaultBgImage(index),
      showHint: false,
      isHovering: false,
      animationData: null,
      emoji: this.getEmojiForCategory(index)
    }));

    const totalBookCount = formattedCategories.reduce((sum, cat) => sum + (cat.bookCount || 0), 0);

    this.setData({
      isLoading: false,
      categories: formattedCategories,
      originalCategories: formattedCategories,
      featuredBooks: this.getDefaultFeaturedBooks(),
      totalBookCount: totalBookCount,
      lastSyncTime: this.formatTime(new Date()) + ' (本地缓存)',
      loadError: false,
      useDefaultData: true,
      databaseEmpty: false,
      connectionError: false
    });

    // 启动动画
    setTimeout(() => {
      this.animateCategories();
    }, 300);
  },

  getDefaultFeaturedBooks() {
    return [
      {
        id: '1',
        title: '人类简史',
        author: '尤瓦尔·赫拉利',
        cover: '/images/covers/sapiens.jpg',
        category: '历史人文',
        rating: 4.8,
        description: '从动物到上帝的人类简史',
        categoryColor: this.data.theme.primary
      },
      {
        id: '2',
        title: '明朝那些事儿',
        author: '当年明月',
        cover: '/images/covers/ming.jpg',
        category: '历史人文',
        rating: 4.7,
        description: '以现代语言讲述明朝历史',
        categoryColor: this.data.theme.primary
      },
      {
        id: '3',
        title: '高效能人士的七个习惯',
        author: '史蒂芬·柯维',
        cover: '/images/covers/7-habits.jpg',
        category: '职场技能',
        rating: 4.9,
        description: '个人管理与职场发展经典',
        categoryColor: this.data.theme.primary
      }
    ];
  },

  // ============ 辅助方法 ============

  getDefaultGradient: function(index) {
    const gradients = [
      'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)',
      'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)',
      'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
      'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
      'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
      'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
      'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
      'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)'
    ];
    return gradients[index % gradients.length] || 'linear-gradient(135deg, #1976D2 0%, #42A5F5 100%)';
  },

  getDefaultColor: function(index) {
    const colors = [
      '#6D28D9',
      '#0EA5E9',
      '#10B981',
      '#F59E0B',
      '#6366F1',
      '#EC4899',
      '#EF4444',
      '#8B5CF6'
    ];
    return colors[index % colors.length] || '#1976D2';
  },

  getDefaultBgImage: function(index) {
    const images = [
      '/images/categories/history-bg.jpg',
      '/images/categories/kids-bg.jpg',
      '/images/categories/family-bg.jpg',
      '/images/categories/literature-bg.jpg',
      '/images/categories/career-bg.jpg',
      '/images/categories/science-bg.jpg',
      '/images/categories/travel-bg.jpg',
      '/images/categories/finance-bg.jpg'
    ];
    return images[index % images.length] || '/images/categories/default-bg.jpg';
  },

  getEmojiForCategory: function(index) {
    const emojis = [
      '🏛️',
      '🧒',
      '🏠',
      '📚',
      '💼',
      '🔬',
      '✈️',
      '📰'
    ];
    return emojis[index % emojis.length] || '📚';
  },

  // ============ 动画效果函数 ============

  // 分类卡片动画效果
  animateCategories: function() {
    setTimeout(() => {
      const query = wx.createSelectorQuery();
      query.selectAll('.category-card').boundingClientRect();
      query.exec((res) => {
        if (res && res[0]) {
          res[0].forEach((rect, index) => {
            if (index < 8) {
              const animation = wx.createAnimation({
                duration: 500,
                delay: index * 80,
                timingFunction: 'ease-out'
              });
              
              animation.translateY(30).opacity(0).step();
              animation.translateY(0).opacity(1).step();
              
              const categoryCards = `categories[${index}].animationData`;
              this.setData({
                [categoryCards]: animation.export()
              });
            }
          });
        }
      });
    }, 300);
  },

  // 卡片触摸开始
  onCardTouchStart: function(e) {
    const index = e.currentTarget.dataset.index;
    
    if (this.data.categories[index]) {
      this.setData({
        [`categories[${index}].showHint`]: true,
        [`categories[${index}].isHovering`]: true
      });
      
      const animation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-out'
      });
      animation.scale(0.98).opacity(0.9).step();
      
      this.setData({
        [`categories[${index}].touchAnimation`]: animation.export()
      });
    }
  },

  // 卡片触摸结束
  onCardTouchEnd: function(e) {
    const index = e.currentTarget.dataset.index;
    
    if (this.data.categories[index]) {
      setTimeout(() => {
        this.setData({
          [`categories[${index}].showHint`]: false,
          [`categories[${index}].isHovering`]: false
        });
      }, 300);
      
      const animation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-in'
      });
      animation.scale(1).opacity(1).step();
      
      this.setData({
        [`categories[${index}].touchAnimation`]: animation.export()
      });
    }
  }
});