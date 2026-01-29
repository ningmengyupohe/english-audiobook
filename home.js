// pages/home/home.js
const userStatusManager = require('../../utils/user-status.js');
// 🚨 关键修复：导入 uni-cloud.js 而不是使用 wx.cloud
const cloudAPI = require('../../utils/uni-cloud.js').cloudAPI;
const app = getApp();

Page({
  data: {
    greeting: '',
    banners: [
      { 
        id: 1, 
        imageUrl: '/images/banners/banner1.jpg', 
        title: '经典文学专题',
        subtitle: 'Explore World Classics',
        linkType: 'category', 
        linkId: '4',
        color: '#1976D2'
      },
      { 
        id: 2, 
        imageUrl: '/images/banners/banner2.jpg', 
        title: '商务英语提升',
        subtitle: 'Essential Workplace Skills',
        linkType: 'category', 
        linkId: '5',
        color: '#0D47A1'
      },
      { 
        id: 3, 
        imageUrl: '/images/banners/banner3.jpg', 
        title: '儿童启蒙乐园',
        subtitle: 'Kids English Adventure',
        linkType: 'category', 
        linkId: '2',
        color: '#2196F3'
      }
    ],
    bannerIndex: 0,
    searchKeyword: '',
    searchResults: [],
    showSearchResults: false,
    isSearching: false,
    quickActions: [
      { id: 1, icon: '🔍', name: '搜索', color: '#FF9800', page: 'search' },
      { id: 2, icon: '⭐', name: '收藏', color: '#FFC107', page: 'my-books', type: 'favorites' },
      { id: 3, icon: '⬇️', name: '下载', color: '#4CAF50', page: 'my-books', type: 'downloaded' },
      { id: 4, icon: '📖', name: '书签', color: '#2196F3', page: 'my-books', type: 'bookmarks' },
      { id: 5, icon: '🎧', name: '历史', color: '#9C27B0', page: 'bookshelf', type: 'history' },
      { id: 6, icon: '🔄', name: '换一本', color: '#E91E63', page: 'refreshDaily' }
    ],
    hotBooks: [],
    recommendedCategories: [],
    dailyRecommendation: null,
    nowPlaying: null,
    isLoading: true,
    isRefreshing: false,
    hasUserInfo: false,
    hasError: false,
    errorMessage: '',
    cloudInitialized: true, // 🚨 修改：直接设为true，因为我们使用URL化方式
    // 🆕 添加数据加载状态
    dataLoadStatus: {
      hotBooks: false,
      categories: false,
      daily: false
    },
    userInfo: null,  // 🆕 添加用户信息字段
  studyStats: {    // 🆕 添加学习统计数据字段
    todayMinutes: 0,
    streakDays: 0,
    totalMinutes: 0,
    goalProgress: 0
  }
  },

  onLoad: function() {
    console.log('🏠 Home页面加载');
    this.setGreeting();
    // 🚨 新增：加载用户信息
    this.loadUserInfo();
    this.loadHomeData();
  },

  onShow: function() {
    console.log('🏠 Home页面显示');
    this.loadNowPlaying();
    
    // 🆕 检查用户状态是否发生变化
    if (app.globalData.userStatusChanged) {
      console.log('🚨 检测到用户状态变化，重新加载用户信息');
      this.loadUserInfo();
      app.globalData.userStatusChanged = false;
    }
    
    if (app.globalData.shouldRefreshHome) {
      console.log('🚨 检测到需要刷新首页数据');
      this.loadHomeData(true);
      app.globalData.shouldRefreshHome = false;
    }
  },

  onPullDownRefresh: function() {
    console.log('🔄 下拉刷新');
    this.loadHomeData(true);
  },

  onReachBottom: function() {
    console.log('📜 滚动到底部');
  },

  setGreeting: function() {
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour >= 5 && hour < 12) {
      greeting = '早上好';
    } else if (hour >= 12 && hour < 14) {
      greeting = '中午好';
    } else if (hour >= 14 && hour < 18) {
      greeting = '下午好';
    } else if (hour >= 18 && hour < 22) {
      greeting = '晚上好';
    } else {
      greeting = '夜深了';
    }
    
    this.setData({ greeting });
  },
// 🆕 添加：加载用户信息函数
loadUserInfo: function() {
    console.log('👤 开始加载用户信息');
    
    // 从 userStatusManager 获取用户信息
    const userInfo = userStatusManager.getUserInfo();
    const userId = userStatusManager.getCurrentUserId();
    
    console.log('🔍 用户信息检查:', {
      hasUserInfo: !!userInfo,
      userId: userId,
      userInfo: userInfo
    });
    
    if (userInfo && userId > 0) {
      console.log('✅ 加载到用户信息:', {
        nickname: userInfo.nickname,
        level: userInfo.level,
        avatar: userInfo.avatar
      });
      
      // 🆕 格式化用户信息用于页面显示
      const formattedUserInfo = {
        nickname: userInfo.nickname || userInfo.username || '英语学习者',
        avatar: userInfo.avatar || '/images/avatar/default.png',
        level: userInfo.level || '初级',
        isVip: userInfo.isVip || false,
        learningDays: userInfo.learningDays || 0,
        userId: userId
      };
      
      this.setData({
        userInfo: formattedUserInfo,
        hasUserInfo: true
      });
      
    } else {
      console.log('⚠️ 未登录或用户信息为空');
      this.setData({
        userInfo: null,
        hasUserInfo: false,
        studyStats: {
          todayMinutes: 0,
          streakDays: 0,
          totalMinutes: 0,
          goalProgress: 0
        }
      });
    }
  },
  // 🚨 修改：删除 initializeCloud 函数，因为我们已经直接使用 URL化调用

  loadHomeData: function(isPullRefresh = false) {
    console.log('🚀 开始加载首页数据');
    console.log('📊 使用uniCloud URL化调用方式');
    
    if (!isPullRefresh) {
      this.setData({ 
        isLoading: true,
        hasError: false,
        // ✅ 重置加载状态
        dataLoadStatus: {
          hotBooks: false,
          categories: false,
          daily: false
        }
      });
    } else {
      this.setData({ isRefreshing: true });
    }
    
    // ✅ 直接并行加载数据
    const loadPromises = [
      this.loadHotBooks().catch(error => {
        console.error('❌ 热门书籍加载失败:', error);
        throw error; // 抛出错误让外层处理
      }),
      this.loadRecommendedCategories().catch(error => {
        console.error('❌ 推荐分类加载失败:', error);
        throw error; // 抛出错误让外层处理
      }),
      this.loadDailyRecommendation().catch(error => {
        console.error('❌ 今日推荐加载失败:', error);
        throw error; // 抛出错误让外层处理
      })
    ];
    
    Promise.all(loadPromises)
      .then(() => {
        console.log('✅ 首页所有数据加载完成');
        this.setData({ 
          isLoading: false,
          hasError: false,
          isRefreshing: false
        });
        
        if (isPullRefresh) {
          wx.stopPullDownRefresh();
          wx.showToast({
            title: '刷新成功',
            icon: 'success',
            duration: 1500
          });
        }
      })
      .catch(error => {
        console.error('❌ 首页数据加载失败:', error);
        this.showEmptyState(isPullRefresh, error);
      });
  },
  
  loadHotBooks: async function() {
    console.log('📚 开始加载热门书籍');
    
    try {
      const result = await cloudAPI.book.getHot(20);
      console.log('📊 热门书籍响应:', result);
      
      let books = [];
      if (result && result.code === 0) {
        books = result.data || result.list || [];
      } else if (Array.isArray(result)) {
        books = result;
      }
      
      console.log(`📊 获取到 ${books.length} 本热门书籍`);
      
      if (books.length === 0) {
        console.log('⚠️ 未获取到热门书籍数据');
        this.setData({ 
          'dataLoadStatus.hotBooks': true 
        });
        throw new Error('暂无热门书籍');
      }
      
      // ✅ 关键：收集所有不同的分类ID
      const uniqueCategoryIds = [...new Set(books.map(book => {
        const id = book.categoryId;
        return id ? id.toString() : null;
      }).filter(id => id))];
      
      console.log('📊 发现的不同分类ID:', uniqueCategoryIds);
      
      // ✅ 直接从数据库查询这些分类
      let categoryMap = {};
      if (uniqueCategoryIds.length > 0) {
        try {
          // 使用云函数直接查询这些分类
          const categoryData = await this.getCategoriesByIds(uniqueCategoryIds);
          console.log('📊 从数据库获取的分类数据:', categoryData);
          
          // 创建映射
          categoryData.forEach(category => {
            const catId = category._id ? category._id.toString() : null;
            if (catId && category.name) {
              categoryMap[catId] = {
                name: category.name,
                icon: category.icon || '📚',
                color: category.categoryColor || '#007AFF',
                enName: category.enName || ''
              };
            }
          });
          
          console.log('📊 分类映射表（从数据库）:');
          Object.keys(categoryMap).forEach(catId => {
            console.log(`  "${catId}" -> "${categoryMap[catId].name}"`);
          });
          
        } catch (error) {
          console.error('❌ 从数据库获取分类失败:', error);
        }
      }
      
      // ✅ 如果还有未找到的分类，使用预定义映射
      uniqueCategoryIds.forEach(catId => {
        if (!categoryMap[catId]) {
          const defaultName = this.getCategoryNameFromId(catId);
          console.log(`⚠️ 分类 ${catId} 在数据库中未找到，使用默认名称: ${defaultName}`);
          categoryMap[catId] = {
            name: defaultName,
            icon: '📚',
            color: '#007AFF',
            enName: ''
          };
        }
      });
      
      const hotBooks = books.map((book, index) => {
        const categoryId = book.categoryId ? book.categoryId.toString() : null;
        let categoryInfo = categoryId ? categoryMap[categoryId] : null;
        
        if (!categoryInfo) {
          categoryInfo = {
            name: this.getCategoryNameFromId(categoryId),
            icon: '📚',
            color: '#007AFF',
            enName: ''
          };
        }
        
        // 使用默认图片
        let coverUrl = '/images/covers/default.jpg';
        
        return {
          id: book._id || book.id,
          title: book.title,
          author: book.author,
          cover: coverUrl,
          playCount: book.likeCount || book.playCount || 0,
          duration: this.formatDuration(book.totalDuration || 0),
          rating: this.calculateRating(book.popularity || 0),
          tags: [book.level || '中级', categoryInfo.name],
          isFree: book.level === '初级' || Math.random() > 0.5,
          category: categoryInfo.name,
          categoryId: book.categoryId,
          categoryIcon: categoryInfo.icon,
          categoryColor: categoryInfo.color,
          // 原始数据用于调试
          _rawCategoryId: book.categoryId,
          _mappedCategory: categoryInfo.name
        };
      });
      
      console.log('✅ 热门书籍转换完成:');
      hotBooks.forEach((book, index) => {
        console.log(`${index + 1}. ${book.title} - 分类: ${book.category} (ID: ${book.categoryId})`);
      });
      
      this.setData({ 
        hotBooks,
        'dataLoadStatus.hotBooks': true 
      });
      return { success: true, data: hotBooks };
      
    } catch (error) {
      console.error('❌ 加载热门书籍失败:', error);
      this.setData({ 
        hotBooks: [],
        'dataLoadStatus.hotBooks': true 
      });
      throw error;
    }
  },
  
  // ✅ 新增：根据ID列表从数据库查询分类
  getCategoriesByIds: async function(categoryIds) {
    console.log('🔍 从数据库查询分类，ID列表:', categoryIds);
    
    if (!categoryIds || categoryIds.length === 0) {
      return [];
    }
    
    try {
      // 调用云函数获取这些分类
      const result = await cloudAPI.book.getCategoryBookCounts({ 
        categoryIds: categoryIds 
      });
      
      console.log('📊 分类查询结果:', result);
      
      if (result && result.code === 0 && result.data && result.data.categories) {
        return result.data.categories;
      }
      
      // 如果上面的接口不支持，使用搜索接口
      const categories = [];
      
      // 逐个查询分类
      for (const categoryId of categoryIds) {
        try {
          const categoryResult = await cloudAPI.book.getCategoryDetail({ 
            categoryId: categoryId 
          });
          
          if (categoryResult && categoryResult.code === 0 && categoryResult.data) {
            categories.push(categoryResult.data);
          }
        } catch (error) {
          console.error(`❌ 查询分类 ${categoryId} 失败:`, error);
        }
      }
      
      return categories;
      
    } catch (error) {
      console.error('❌ 批量查询分类失败:', error);
      return [];
    }
  },
  
  // ✅ 更新：根据ID获取分类名称（简化版）
  getCategoryNameFromId: function(categoryId) {
    if (!categoryId) return '未分类';
    
    const idStr = categoryId.toString();
    
    // 常见ID映射
    const commonMap = {
      '1': '历史人文',
      '2': '儿童启蒙',
      '3': '科学科普',
      '4': '文学名著',
      '5': '财经商业',
      '6': '教育培训',
      '7': '经典必读',
      '8': '语言学习',
      'C001': '经典文学',
      'C002': '儿童故事',
      'C003': '商务英语',
      'C004': '科技科普',
    };
    
    return commonMap[idStr] || '未分类';
  },
  
  // ✅ 添加或更新 getDefaultCategoryName 函数
  getDefaultCategoryName: function(categoryId) {
    if (!categoryId) return '未分类';
    
    const categoryMap = {
      // 数字ID
      '1': '历史',
      '2': '儿童',
      '3': '科学',
      '4': '文学',
      '5': '财经',
      '6': '教育',
      '7': '经典',
      '8': '语言',
      
      // 字符串ID
      'C001': '经典文学',
      'C002': '儿童启蒙',
      'C003': '商务英语',
      'C004': '科技科普',
      
      // 数据库可能使用的其他ID格式
      '667eea0b': '文学名著',
    };
    
    const idStr = categoryId.toString();
    
    // 尝试直接匹配
    if (categoryMap[idStr]) {
      return categoryMap[idStr];
    }
    
    // 尝试数字匹配（如4匹配"4"）
    const numId = parseInt(idStr);
    if (!isNaN(numId) && categoryMap[numId.toString()]) {
      return categoryMap[numId.toString()];
    }
    
    // 特殊处理：C001, C002等
    if (idStr.startsWith('C')) {
      return idStr === 'C001' ? '经典文学' : 
             idStr === 'C002' ? '儿童启蒙' :
             idStr === 'C003' ? '商务英语' :
             idStr === 'C004' ? '科技科普' : '未分类';
    }
    
    // 如果是以字母开头的ID，尝试猜测
    if (/^[a-f0-9]+$/i.test(idStr)) {
      console.log(`⚠️ 未知的哈希ID: ${idStr}，返回"其他"`);
      return '其他';
    }
    
    return '未分类';
  },
  
  // ✅ 添加辅助函数：根据分类ID获取默认分类名
  getDefaultCategoryName: function(categoryId) {
    const categoryMap = {
      1: '历史',
      2: '儿童',
      3: '科学',
      4: '文学',
      5: '财经',
      6: '教育',
      7: '经典',
      8: '语言'
    };
    
    return categoryMap[categoryId] || '未分类';
  },
  
  // ✅ 添加辅助函数：检查图片是否存在（简化版）
  checkImageExists: function(imagePath) {
    // 这里可以添加更复杂的图片存在性检查
    // 目前只检查常见图片格式
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    return validExtensions.some(ext => imagePath.toLowerCase().endsWith(ext));
  },
  // 🚨 修改：删除 showMockData 函数，因为我们总是使用真实数据

  // 🆕 显示空状态
  showEmptyState: function(isPullRefresh = false, error = null) {
    console.log('📭 显示空状态');
    
    this.setData({ 
      hotBooks: [],
      recommendedCategories: [],
      dailyRecommendation: null,
      isLoading: false,
      isRefreshing: false,
      hasError: true,
      errorMessage: error ? error.message || '数据加载失败' : '暂无数据'
    });
    
    if (isPullRefresh) {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '数据加载失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  

// ✅ 添加缺失的工具函数
getCategoryColorByIndex: function(index) {
  const colors = ['#FF9500', '#FF2D55', '#007AFF', '#5AC8FA', '#34C759', '#AF52DE', '#FF9F0A', '#FF375F'];
  return colors[index % colors.length] || '#007AFF';
},

getCategoryIcon: function(icon) {
  // 如果是表情符号，直接使用；如果是图片URL，使用默认表情
  if (typeof icon === 'string') {
    if (icon.includes('.png') || icon.includes('.jpg') || icon.includes('.jpeg') || 
        icon.includes('http://') || icon.includes('https://')) {
      // 是图片URL，返回默认表情
      const defaultIcons = ['📚', '🏛️', '🧒', '💼', '🔬', '🎭', '🎵', '🌍'];
      return defaultIcons[Math.floor(Math.random() * defaultIcons.length)];
    }
    return icon;
  }
  return '📚';
},

 // 在 home.js 中修改 loadRecommendedCategories 函数

loadRecommendedCategories: async function() {
    console.log('📂 开始加载推荐分类及书籍');
    
    try {
      // ✅ 修复：使用正确的API路径：book.getPopularCategories
      const categoriesResult = await cloudAPI.book.getPopularCategories(4);
      console.log('📊 热门分类响应:', categoriesResult);
      
      let categories = [];
      
      // 处理不同的返回格式
      if (categoriesResult && categoriesResult.code === 0) {
        // 标准格式：{code: 0, data: [...]}
        categories = categoriesResult.data || categoriesResult.list || [];
      } else if (categoriesResult && Array.isArray(categoriesResult)) {
        // 直接返回数组
        categories = categoriesResult;
      } else if (categoriesResult && categoriesResult.success) {
        // 包含success字段的格式
        categories = categoriesResult.data || categoriesResult.list || [];
      }
      
      console.log(`📊 获取到 ${categories.length} 个分类`);
      
      if (categories.length === 0) {
        console.log('⚠️ 未获取到分类数据，使用备用数据');
        this.setBackupCategories();
        return { success: false, data: [] };
      }
      
      // ✅ 为每个分类获取热门书籍
      const categoryPromises = categories.map(async (category) => {
        try {
          const categoryId = category._id || category.id;
          
          // ✅ 获取该分类下的热门书籍
          const booksResult = await cloudAPI.book.getByCategory(categoryId, { 
            limit: 3,
            sort: 'hot'
          });
          
          let books = [];
          if (booksResult && booksResult.code === 0) {
            books = booksResult.data || booksResult.list || [];
          } else if (Array.isArray(booksResult)) {
            books = booksResult;
          }
          
          // ✅ 格式化书籍数据
          const formattedBooks = books.slice(0, 3).map(book => ({
            id: book._id || book.id,
            title: book.title || '未命名',
            author: book.author || '未知作者',
            cover: book.cover || '/images/covers/default.jpg',
            rating: this.calculateRating(book.popularity || book.likeCount || 0),
            duration: this.formatDuration(book.totalDuration || 0),
            level: book.level || '中级'
          }));
          
          return {
            category: {
              id: categoryId,
              name: category.name || '未命名',
              icon: this.getCategoryIcon(category.icon),
              color: category.categoryColor || this.getCategoryColorByIndex(categories.indexOf(category)),
              bookCount: category.bookCount || formattedBooks.length
            },
            books: formattedBooks
          };
        } catch (error) {
          console.error(`❌ 获取分类 ${category.name} 的书籍失败:`, error);
          // 返回一个默认结构，避免整个Promise.all失败
          return {
            category: {
              id: category._id || category.id,
              name: category.name || '未命名',
              icon: this.getCategoryIcon(category.icon),
              color: this.getCategoryColorByIndex(categories.indexOf(category)),
              bookCount: 0
            },
            books: []
          };
        }
      });
      
      // ✅ 等待所有分类数据加载完成
      const categoryData = await Promise.allSettled(categoryPromises);
      
      // ✅ 过滤掉失败的结果
      const validCategoryData = categoryData
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value)
        .filter(item => item.books.length > 0); // 只保留有书籍的分类
      
      if (validCategoryData.length === 0) {
        console.log('⚠️ 所有分类书籍获取失败，使用备用数据');
        this.setBackupCategories();
        return { success: false, data: [] };
      }
      
      // ✅ 更新页面数据
      this.setData({ 
        recommendedCategories: validCategoryData,
        'dataLoadStatus.categories': true 
      });
      
      console.log('✅ 推荐分类及书籍加载完成，数量:', validCategoryData.length);
      return { success: true, data: validCategoryData };
      
    } catch (error) {
      console.error('❌ 加载推荐分类失败:', error);
      this.setBackupCategories();
      return { success: false, error: error.message };
    }
  },
  
  // ✅ 保留原有的辅助函数
  getCategoryColorByIndex: function(index) {
    const colors = ['#FF9500', '#FF2D55', '#007AFF', '#5AC8FA', '#34C759', '#AF52DE', '#FF9F0A', '#FF375F'];
    return colors[index % colors.length] || '#007AFF';
  },
  
  getCategoryIcon: function(icon) {
    // 如果是表情符号，直接使用；如果是图片URL，使用默认表情
    if (typeof icon === 'string') {
      if (icon.includes('.png') || icon.includes('.jpg') || icon.includes('.jpeg') || 
          icon.includes('http://') || icon.includes('https://')) {
        // 是图片URL，返回默认表情
        const defaultIcons = ['📚', '🏛️', '🧒', '💼', '🔬', '🎭', '🎵', '🌍'];
        return defaultIcons[Math.floor(Math.random() * defaultIcons.length)];
      }
      return icon;
    }
    return '📚';
  },

  // 格式化分类数据
  formatCategories: function(categories) {
    const defaultIcons = ['🏛️', '🧒', '📚', '💼', '🔬', '🎭', '🎵', '🌍', '💰', '✈️'];
    
    return categories.map((category, index) => {
      // 🚨 清理所有可能的图片字段
      const cleanCategory = { ...category };
      
      // 🚨 关键：检查并清理 icon 字段
      let icon = cleanCategory.icon || '';
      
      // 如果 icon 是图片URL，则替换为默认图标
      if (typeof icon === 'string' && 
          (icon.includes('.png') || 
           icon.includes('.jpg') || 
           icon.includes('.jpeg') || 
           icon.includes('images/') ||
           icon.includes('http://') ||
           icon.includes('https://'))) {
        console.warn('⚠️ 发现图片URL作为icon，已替换:', icon);
        icon = defaultIcons[index % defaultIcons.length];
      }
      
      // 删除所有图片相关字段
      const forbiddenFields = ['cover', 'image', 'imageUrl', 'iconUrl', 'picture', 'banner', 'thumbnail'];
      forbiddenFields.forEach(field => delete cleanCategory[field]);
      
      const categoryId = cleanCategory._id || cleanCategory.id || `cat-${index}`;
      const categoryName = cleanCategory.name || '未命名';
      const bookCount = cleanCategory.bookCount || cleanCategory.count || 0;
      
      return {
        id: categoryId,
        name: categoryName,
        enName: cleanCategory.enName || this.generateEnName(categoryName),
        // 🚨 使用处理过的 icon
        icon: icon || defaultIcons[index % defaultIcons.length],
        color: cleanCategory.categoryColor || this.getCategoryColor(index),
        bookCount: bookCount,
        isHot: cleanCategory.isHot || false,
        isRecommend: cleanCategory.isRecommend || false,
      };
    });
  },

  // 生成英文名称
  generateEnName: function(chineseName) {
    const nameMap = {
      '文学': 'Literature',
      '历史': 'History',
      '科学': 'Science',
      '教育': 'Education',
      '财经': 'Finance',
      '语言': 'Language',
      '经典': 'Classics',
      '儿童': 'Kids',
      '商务': 'Business',
      '技术': 'Technology',
      '家庭': 'Family',
      '旅游': 'Travel',
      '文化': 'Culture',
      '科普': 'Science Pop'
    };
    
    for (const [key, value] of Object.entries(nameMap)) {
      if (chineseName.includes(key)) {
        return value;
      }
    }
    
    return 'General';
  },

  // 获取分类图标
  getCategoryIcon: function(index) {
    const icons = ['🏛️', '🧒', '📚', '💼', '🔬', '🎭', '🎵', '🌍', '💰', '✈️'];
    return icons[index % icons.length] || '📚';
  },

  // 获取分类颜色
  getCategoryColor: function(index) {
    const colors = ['#FF9500', '#FF2D55', '#007AFF', '#5AC8FA', '#34C759', '#AF52DE', '#FF9F0A', '#FF375F'];
    return colors[index % colors.length] || '#007AFF';
  },

  // 获取分类渐变
  getCategoryGradient: function(index) {
    const gradients = [
      'linear-gradient(135deg, #FF9500 0%, #FFCC00 100%)',
      'linear-gradient(135deg, #FF2D55 0%, #FF6B6B 100%)',
      'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
      'linear-gradient(135deg, #5AC8FA 0%, #4ECDC4 100%)',
      'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
      'linear-gradient(135deg, #AF52DE 0%, #BF5AF2 100%)'
    ];
    return gradients[index % gradients.length] || 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)';
  },

  // 备用数据函数
  setBackupCategories: function() {
    const backupCategories = [
      {
        id: 'backup-1',
        name: '经典文学',
        enName: 'Classic Literature',
        icon: '📚',
        color: '#FF9500',
        gradient: 'linear-gradient(135deg, #FF9500 0%, #FFCC00 100%)',
        bookCount: 128,
        isHot: true,
        isRecommend: true
      },
      {
        id: 'backup-2',
        name: '儿童启蒙',
        enName: 'Kids Learning',
        icon: '🧒',
        color: '#FF2D55',
        gradient: 'linear-gradient(135deg, #FF2D55 0%, #FF6B6B 100%)',
        bookCount: 96,
        isHot: true,
        isRecommend: true
      },
      {
        id: 'backup-3',
        name: '商务英语',
        enName: 'Business English',
        icon: '💼',
        color: '#007AFF',
        gradient: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
        bookCount: 85,
        isHot: true,
        isRecommend: false
      },
      {
        id: 'backup-4',
        name: '科技科普',
        enName: 'Science & Tech',
        icon: '🔬',
        color: '#5AC8FA',
        gradient: 'linear-gradient(135deg, #5AC8FA 0%, #4ECDC4 100%)',
        bookCount: 72,
        isHot: false,
        isRecommend: true
      }
    ];
    
    this.setData({ 
      recommendedCategories: backupCategories,
      'dataLoadStatus.categories': true 
    });
    
    console.log('🆘 已加载备用分类数据');
  },

  loadDailyRecommendation: async function() {
    console.log('🎯 开始加载今日推荐');
    
    // 使用缓存机制，但允许手动刷新
    const today = new Date().toDateString();
    const cacheKey = `dailyRandom_${today}`;
    
    try {
      const cachedRecommendation = wx.getStorageSync(cacheKey);
      if (cachedRecommendation && !this.data.forceRefreshDaily) {
        console.log('📦 使用缓存的随机推荐');
        this.setData({ 
          dailyRecommendation: cachedRecommendation,
          'dataLoadStatus.daily': true 
        });
        return { success: true, data: cachedRecommendation };
      }
    } catch (error) {
      console.log('❌ 读取缓存失败，重新获取');
    }
    
    try {
      // 🚨 使用 uni-cloud.js 封装的 API
      // 先获取热门书籍，然后随机选择一本
      const result = await cloudAPI.book.getHot(20);
      console.log('📊 热门书籍响应（用于随机推荐）:', result);
      
      let books = [];
      if (result && result.code === 0) {
        books = result.data || result.list || [];
      } else if (Array.isArray(result)) {
        books = result;
      }
      
      if (books.length === 0) {
        console.log('⚠️ 未获取到随机书籍');
        this.setData({ 
          dailyRecommendation: null,
          'dataLoadStatus.daily': true 
        });
        return { success: false, data: null };
      }
      
      // 使用日期种子随机选择一本书
      const todaySeed = this.getDailySeed();
      const randomIndex = todaySeed % books.length;
      const book = books[randomIndex];
      
      // 生成推荐理由
      const recommendReason = this.generateDailyRecommendReason(book);
      
      // 格式化推荐数据
      const recommendation = {
        id: book._id || book.id,
        title: book.title,
        subtitle: book.subtitle || '',
        author: book.author,
        cover: book.cover || '/images/covers/default.jpg',
        description: book.description || '今日精选推荐',
        reason: recommendReason,
        category: book.categoryName || '未分类',
        color: this.getRecommendationColor(book.level || '中级'),
        badge: this.getRecommendationBadge(book),
        level: book.level || '中级',
        duration: this.formatDuration(book.totalDuration || 0),
        rating: this.calculateRating(book.popularity || 0),
        popularity: book.popularity || 0,
        isRecommend: book.isRecommend || false
      };
      
      console.log('✅ 随机推荐数据:', recommendation.title);
      
      // 缓存到本地
      try {
        wx.setStorageSync(cacheKey, recommendation);
        // 同时存储日期标记
        wx.setStorageSync('lastDailyDate', today);
      } catch (error) {
        console.warn('⚠️ 缓存失败:', error);
      }
      
      this.setData({ 
        dailyRecommendation: recommendation,
        'dataLoadStatus.daily': true,
        forceRefreshDaily: false // 重置强制刷新标志
      });
      
      // 添加到历史记录
      this.addToDailyHistory(recommendation);
      
      return { success: true, data: recommendation };
      
    } catch (error) {
      console.error('❌ 加载今日推荐失败:', error);
      this.setData({ 
        dailyRecommendation: null,
        'dataLoadStatus.daily': true 
      });
      throw error;
    }
  },

  // 获取每日种子（基于年月日）
  getDailySeed: function() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    return parseInt(`${year}${month < 10 ? '0' + month : month}${day < 10 ? '0' + day : day}`);
  },
  
  // 生成每日推荐理由
  generateDailyRecommendReason: function(book) {
    // 使用数据库中的推荐理由（如果有）
    if (book.recommendReason) {
      return book.recommendReason;
    }
    
    const reasons = [
      '根据您的学习历史推荐',
      '适合您当前水平的书籍',
      '本周热门精选',
      '同类书籍中的佳作',
      '编辑精心挑选',
      '用户好评率超过95%',
      '多人正在收听',
      '新用户必读推荐',
      '经典中的经典',
      '提升英语能力的好书'
    ];
    
    // 基于书籍属性生成更精准的理由
    const levelReasons = {
      '初级': '适合入门学习者的轻松读物',
      '中级': '适合提升英语水平的中级读物',
      '高级': '适合英语高手的挑战读物'
    };
    
    const randomReason = reasons[Math.floor(Math.random() * reasons.length)];
    const levelReason = levelReasons[book.level] || '';
    
    return levelReason ? `${randomReason}，${levelReason}` : randomReason;
  },
  
  // 根据书籍属性获取角标
  getRecommendationBadge: function(book) {
    if (book.recommendBadge) {
      return book.recommendBadge;
    }
    
    // 基于书籍属性决定角标
    if (book.popularity > 5000) {
      return 'hot';
    } else if (book.level === '初级') {
      return 'free';
    } else if (book.isRecommend) {
      return 'best';
    } else if (book.recommendType && book.recommendType.includes('new_release')) {
      return 'new';
    }
    
    return 'recommend';
  },
  
  // 根据难度等级获取颜色
  getRecommendationColor: function(level) {
    const colorMap = {
      '初级': '#4CAF50',  // 绿色
      '中级': '#FF9800',  // 橙色
      '高级': '#F44336'   // 红色
    };
    return colorMap[level] || '#FF9800';
  },
  
  // 添加到每日推荐历史
  addToDailyHistory: function(recommendation) {
    try {
      const historyKey = 'dailyRecommendHistory';
      let history = wx.getStorageSync(historyKey) || [];
      
      const today = new Date().toDateString();
      
      // 过滤掉今天的记录（避免重复）
      history = history.filter(item => {
        return item.date !== today;
      });
      
      // 添加新记录
      history.unshift({
        date: today,
        bookId: recommendation.id,
        title: recommendation.title,
        reason: recommendation.reason
      });
      
      // 限制历史记录数量（保留30天）
      if (history.length > 30) {
        history = history.slice(0, 30);
      }
      
      wx.setStorageSync(historyKey, history);
    } catch (error) {
      console.error('保存推荐历史失败:', error);
    }
  },
  
  // 刷新今日推荐
  refreshDailyRecommendation: function() {
    console.log('🔄 手动刷新今日推荐');
    
    // 显示加载动画
    wx.showLoading({
      title: '正在换一本...',
    });
    
    // 设置强制刷新标志
    this.setData({
      forceRefreshDaily: true
    });
    
    // 清除今天的缓存
    const today = new Date().toDateString();
    wx.removeStorageSync(`dailyRandom_${today}`);
    
    // 重新加载推荐
    this.loadDailyRecommendation()
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '已更换推荐',
          icon: 'success',
          duration: 1500
        });
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showToast({
          title: '刷新失败',
          icon: 'none',
          duration: 2000
        });
        console.error('刷新推荐失败:', error);
      });
  },
  
  // 长按今日推荐显示更多操作
  onDailyLongPress: function() {
    wx.showActionSheet({
      itemList: ['查看历史推荐', '更换推荐'],
      success: (res) => {
        const tapIndex = res.tapIndex;
        switch(tapIndex) {
          case 0:
            this.showDailyHistory();
            break;
          case 1:
            this.refreshDailyRecommendation();
            break;
        }
      }
    });
  },
  
  // 显示历史推荐
  showDailyHistory: function() {
    try {
      const history = wx.getStorageSync('dailyRecommendHistory') || [];
      
      if (history.length === 0) {
        wx.showToast({
          title: '暂无历史记录',
          icon: 'none'
        });
        return;
      }
      
      const historyItems = history.map(item => `${item.date}: ${item.title}`);
      const historyText = historyItems.join('\n');
      
      wx.showModal({
        title: '历史推荐记录',
        content: historyText.slice(0, 300) + (historyText.length > 300 ? '...' : ''),
        showCancel: true,
        cancelText: '关闭',
        confirmText: '清空记录',
        success: (res) => {
          if (res.confirm) {
            wx.removeStorageSync('dailyRecommendHistory');
            wx.showToast({
              title: '已清空历史记录',
              icon: 'success'
            });
          }
        }
      });
    } catch (error) {
      console.error('显示历史记录失败:', error);
    }
  },

  loadNowPlaying: function() {
    try {
      const nowPlaying = wx.getStorageSync('nowPlaying');
      
      if (nowPlaying) {
        this.setData({ nowPlaying });
        console.log('🎧 加载正在播放:', nowPlaying.bookTitle);
        return nowPlaying;
      }
      
      return null;
    } catch (error) {
      console.error('❌ 加载正在播放失败:', error);
      return null;
    }
  },

  // ==================== 搜索功能 ====================
  
  onSearchTap: function() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  onSearchInput: function(e) {
    const keyword = e.detail.value.trim();
    this.setData({
      searchKeyword: keyword,
      isSearching: keyword.length > 0
    });
    
    // 防抖处理
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    
    this.searchTimer = setTimeout(() => {
      if (keyword) {
        this.performSearch(keyword);
      } else {
        this.setData({
          showSearchResults: false,
          searchResults: [],
          isSearching: false
        });
      }
    }, 300);
  },

  onSearchConfirm: function(e) {
    const keyword = e.detail.value.trim();
    if (keyword) {
      this.performSearch(keyword);
    }
  },

  // 执行搜索
  performSearch: async function(keyword) {
    if (!keyword) return;
    
    console.log('🔍 开始搜索:', keyword);
    
    try {
      this.setData({ 
        isSearching: true,
        showSearchResults: true 
      });
      
      // 添加搜索延迟效果，防止闪烁
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 🚨 使用 uni-cloud.js 封装的 API
      const result = await cloudAPI.book.search(keyword, { limit: 10 });
      console.log('📊 搜索结果响应:', result);
      
      let books = [];
      if (result && result.code === 0) {
        books = result.data || result.list || [];
      } else if (Array.isArray(result)) {
        books = result;
      }
      
      const searchResults = books.map(book => ({
        id: book._id || book.id,
        title: book.title,
        author: book.author,
        cover: book.cover || '/images/covers/default.jpg',
        playCount: book.likeCount || 0,
        rating: this.calculateRating(book.popularity || 0),
        duration: this.formatDuration(book.totalDuration || 0),
        category: book.categoryName || '未分类'
      }));
      
      // 搜索无结果时的处理
      if (searchResults.length === 0 && keyword.length > 0) {
        console.log('⚠️ 搜索无结果:', keyword);
      }
      
      this.setData({
        searchResults,
        isSearching: false
      });
      
    } catch (error) {
      console.error('❌ 搜索失败:', error);
      this.setData({
        searchResults: [],
        isSearching: false
      });
      
      wx.showToast({
        title: '搜索失败，请重试',
        icon: 'error',
        duration: 2000
      });
    }
  },

  clearSearch: function() {
    this.setData({
      searchKeyword: '',
      searchResults: [],
      showSearchResults: false,
      isSearching: false
    });
  },

  onSearchResultTap: function(e) {
    const bookId = e.currentTarget.dataset.id;
    this.clearSearch();
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${bookId}`
    });
  },

  // ==================== 事件处理 ====================
  
  onBannerChange: function(e) {
    this.setData({
      bannerIndex: e.detail.current
    });
  },

  onBannerTap: function(e) {
    const bannerId = e.currentTarget.dataset.id;
    const banner = this.data.banners.find(item => item.id === bannerId);
    
    if (banner) {
      if (banner.linkType === 'category') {
        wx.navigateTo({
          url: `/pages/category-list/category-list?categoryId=${banner.linkId}&categoryName=${banner.title}`
        });
      } else if (banner.linkType === 'url' && banner.linkUrl) {
        wx.navigateTo({
          url: banner.linkUrl
        });
      }
    }
  },

  onQuickActionTap: function(e) {
    const page = e.currentTarget.dataset.page;
    const actionId = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    
    console.log('⚡ 快捷功能点击:', page, actionId, type);
    
    // 检查登录状态（除了搜索功能）
    if (page !== 'search') {
      if (!userStatusManager.isLoggedIn()) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        this.goToLogin();
        return;
      }
    }
    
    switch(page) {
      case 'search':
        this.goToSearch();
        break;
      case 'my-books':
        this.goToMyBooks(type);
        break;
      case 'bookshelf':
        this.goToBookshelf(type);
        break;
      // 在 onQuickActionTap 函数中添加 case
      case 'refreshDaily':
        this.refreshDailyRecommendation();
        break;
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
    }
  },

  // ==================== 页面跳转 ====================
  
  goToSearch: function() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  goToMyBooks: function(type) {
    console.log('跳转到我的书籍，类型:', type);
    
    if (!userStatusManager.isLoggedIn()) {
      this.goToLogin();
      return;
    }
    
    const userId = userStatusManager.getCurrentUserId();
    if (!userId || userId <= 0) {
      wx.showToast({
        title: '用户信息异常',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    let pageTitle = '';
    switch(type) {
      case 'favorites':
        pageTitle = '我的收藏';
        break;
      case 'downloaded':
        pageTitle = '已下载';
        break;
      case 'bookmarks':
        pageTitle = '阅读书签';
        break;
      default:
        pageTitle = '我的书籍';
    }
    
    console.log(`🚨 传递参数: type=${type}, title=${pageTitle}, userId=${userId}`);
    
    wx.navigateTo({
      url: `/pages/my-books/my-books?type=${type}&title=${pageTitle}&userId=${userId}`
    });
  },

  goToBookshelf: function(type) {
    console.log('跳转到书架，类型:', type);
    
    if (!userStatusManager.isLoggedIn()) {
      this.goToLogin();
      return;
    }
    
    wx.switchTab({
      url: '/pages/bookshelf/bookshelf'
    });
  },

  goToProfile: function() {
    console.log('跳转到个人中心');
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  goToBookDetail: function(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${bookId}`
    });
  },

  goToCategory: function(e) {
    const categoryId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/category-list/category-list?categoryId=${categoryId}`
    });
  },

  goToAllCategories: function() {
    wx.navigateTo({
      url: '/pages/category/category'
    });
  },

  goToHotList: function() {
    wx.navigateTo({
      url: '/pages/category-list/category-list?categoryId=hot'
    });
  },

  onDailyRecommendTap: function() {
    if (this.data.dailyRecommendation) {
      wx.navigateTo({
        url: `/pages/book-detail/book-detail?id=${this.data.dailyRecommendation.id}`
      });
    }
  },

  onNowPlayingTap: function() {
    if (this.data.nowPlaying) {
      wx.navigateTo({
        url: `/pages/player/player?bookId=${this.data.nowPlaying.bookId}`
      });
    }
  },

  goToStudyReport: function() {
    wx.navigateTo({
      url: '/pages/study-report/study-report'
    });
  },

  // ==================== 登录相关 ====================
  
  goToLogin: function() {
    console.log('跳转到登录页面');
    
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const currentRoute = currentPage.route;
    
    wx.navigateTo({
      url: `/pages/login/login?redirect=${encodeURIComponent('/' + currentRoute)}&from=home`
    });
  },

  // ==================== 其他功能 ====================
  
  randomPlay: function() {
    if (this.data.hotBooks.length === 0) {
      wx.showToast({
        title: '暂无书籍可播放',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * this.data.hotBooks.length);
    const randomBook = this.data.hotBooks[randomIndex];
    
    const animation = wx.createAnimation({
      duration: 300,
      timingFunction: 'ease'
    });
    animation.scale(0.95).step();
    animation.scale(1).step();
    
    this.setData({
      randomButtonAnimation: animation.export()
    });
    
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/player/player?bookId=${randomBook.id}&from=random`
      });
    }, 300);
  },

  // ==================== 工具函数 ====================
  
  formatDuration: function(seconds) {
    if (!seconds) return '1h';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  },

  calculateRating: function(popularity) {
    const baseRating = 4.0;
    const popularityFactor = popularity / 10000;
    const rating = Math.min(5.0, baseRating + popularityFactor);
    return rating.toFixed(1);
  },

  // ==================== 分享功能 ====================
  
  onShareAppMessage: function() {
    const nickname = this.data.userInfo?.nickname || '英语学习者';
    return {
      title: `${nickname} 邀请你一起学习英语`,
      path: '/pages/home/home',
      imageUrl: '/images/share/home.jpg'
    };
  },

  onAddToFavorites: function() {
    return {
      title: '英语听书',
      imageUrl: '/images/logo.png'
    };
  },

  // ==================== 错误处理 ====================
  
  retryLoad: function() {
    console.log('🔄 重新加载数据');
    this.loadHomeData();
  }
});