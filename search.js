// pages/search/search.js
const { callCloud, cloudAPI } = require('../../utils/uni-cloud');

Page({
  data: {
    // 搜索相关
    searchKeyword: '',
    searchResults: [],
    filteredResults: [],
    searchHistory: [],
    hotKeywords: [
      { keyword: '红楼梦', type: '书籍', icon: '📚', color: '#f5222d' },
      { keyword: '穷爸爸富爸爸', type: '书籍', icon: '💰', color: '#52c41a' },
      { keyword: '时间简史', type: '书籍', icon: '⏰', color: '#1890ff' },
      { keyword: '历史', type: '分类', icon: '🏛️', color: '#1890ff' },
      { keyword: '文学', type: '分类', icon: '📖', color: '#1890ff' },
      { keyword: '科学', type: '分类', icon: '🔬', color: '#1890ff' }
    ],
    
    // 状态相关
    isLoading: false,
    loadError: false,
    errorMessage: '',
    hasMore: true,
    currentPage: 1,
    pageSize: 10,
    totalResults: 0,
    
    // 筛选相关
    activeSort: 'relevance',
    activeDifficulty: 'all',
    activeCategories: [],
    hasActiveFilters: false,
    
    // 分类标签相关
    categoryTags: [],          // 扁平化标签列表（用于显示）
    categoryTree: [],          // 树形结构分类（用于层级展示）
    expandedParentIds: [],     // 展开的父分类ID列表
    selectedParentIds: [],     // 选中的父分类ID列表
    selectedSubCategoryIds: [], // 选中的子分类ID列表
    
    // 显示控制
    showFilters: false,
    showSearchResults: false,
    
    // 所有分类信息（从数据库加载）
    allCategories: [],
    
    // 分类映射表（数字ID -> 分类对象）
    categoryIdMap: {},
    
    // 修复标志
    forceLoadCategories: true
  },

  onLoad: function(options) {
    console.log('搜索页面加载');
    
    // 加载搜索历史
    this.loadSearchHistory();
    
    // ✅ 关键修复：强制加载所有分类信息
    this.forceLoadAllCategories();
    
    // 如果有传入的关键词，直接搜索
    if (options.keyword) {
      const keyword = decodeURIComponent(options.keyword);
      this.setData({
        searchKeyword: keyword,
        showFilters: false,
        showSearchResults: false
      });
      
      setTimeout(() => {
        this.performSearch(keyword);
      }, 300);
    }
  },

  onShow: function() {
    this.loadSearchHistory();
  },

  // ============ 关键修复：强制加载所有分类信息 ============

  // 强制加载所有分类信息
  async forceLoadAllCategories() {
    console.log('🔄 强制加载所有分类信息');
    
    try {
      // 方法1：调用 getAllCategories 接口
      const result = await callCloud('book-service', {
        action: 'getAllCategories'
      });
      
      console.log('📊 getAllCategories 响应:', result);
      
      let categories = [];
      
      if (result && result.success === true && result.data) {
        // 解析扁平化分类列表
        if (result.data.flatList && Array.isArray(result.data.flatList)) {
          categories = result.data.flatList;
        } else if (Array.isArray(result.data)) {
          categories = result.data;
        }
      } else if (Array.isArray(result)) {
        categories = result;
      }
      
      if (categories.length === 0) {
        console.log('❌ getAllCategories 返回空，尝试备选方案');
        await this.fallbackLoadCategories();
        return;
      }
      
      console.log(`✅ 通过 getAllCategories 获取到 ${categories.length} 个分类`);
      
      // 处理分类数据
      this.processCategories(categories);
      
    } catch (error) {
      console.error('❌ getAllCategories 失败，尝试备选方案:', error);
      await this.fallbackLoadCategories();
    }
  },

  // 备选方案：通过 getCategories 接口加载
  async fallbackLoadCategories() {
    console.log('🔄 使用备选方案加载分类信息');
    
    try {
      const result = await callCloud('book-service', {
        action: 'getCategories',
        page: 1,
        pageSize: 100,
        withBookCount: true
      });
      
      console.log('📊 getCategories 响应:', result);
      
      let categories = [];
      
      if (result && result.success === true && result.data) {
        if (result.data.list && Array.isArray(result.data.list)) {
          categories = result.data.list;
        } else if (Array.isArray(result.data)) {
          categories = result.data;
        }
      } else if (Array.isArray(result)) {
        categories = result;
      }
      
      if (categories.length === 0) {
        console.log('❌ 所有方案都失败了，使用默认分类');
        this.useDefaultCategories();
        return;
      }
      
      console.log(`✅ 通过 getCategories 获取到 ${categories.length} 个分类`);
      
      // 处理分类数据
      this.processCategories(categories);
      
    } catch (error) {
      console.error('❌ 备选方案也失败了:', error);
      this.useDefaultCategories();
    }
  },

  // 处理分类数据
  processCategories(categories) {
    console.log('🔄 处理分类数据');
    
    // 1. 构建分类映射表（支持字符串和数字ID）
    const categoryIdMap = {};
    
    categories.forEach(category => {
      const categoryId = category._id || category.id;
      if (categoryId) {
        // 创建分类对象
        const categoryObj = {
          _id: categoryId,
          id: categoryId,
          name: category.name || '未分类',
          enName: category.enName || '',
          parentId: category.parentId || '',
          sort: category.sort || 0,
          icon: category.icon || this.getDefaultIcon(category.name),
          description: category.description || '',
          bookCount: category.bookCount || 0,
          difficulty: category.difficulty || '初级',
          gradient: category.gradient || '',
          categoryColor: category.categoryColor || this.getDefaultColor(category.name),
          isHot: category.isHot || false,
          isRecommend: category.isRecommend || false,
          status: category.status || 1
        };
        
        // ✅ 关键：为数字ID和字符串ID都建立映射
        categoryIdMap[categoryId] = categoryObj;
        
        // 如果是字符串ID，尝试转换为数字建立映射
        const numId = parseInt(categoryId);
        if (!isNaN(numId)) {
          categoryIdMap[numId] = categoryObj;
          categoryIdMap[numId.toString()] = categoryObj;
        }
        
        // 如果是数字ID，也建立字符串映射
        if (typeof categoryId === 'number') {
          categoryIdMap[categoryId.toString()] = categoryObj;
        }
      }
    });
    
    console.log('📊 分类映射表构建完成，大小:', Object.keys(categoryIdMap).length);
    
    this.setData({
      allCategories: categories,
      categoryIdMap: categoryIdMap
    });
    
    console.log('✅ 分类数据处理完成');
  },

  // 使用默认分类（最后的手段）
  useDefaultCategories() {
    console.log('🔄 使用默认分类数据');
    
    const defaultCategories = [
      { 
        _id: '1', 
        id: '1', 
        name: '历史人文', 
        parentId: '', 
        icon: '/images/categories/history.png', 
        categoryColor: '#6D28D9', 
        sort: 1,
        bookCount: 156
      },
      { 
        _id: '2', 
        id: '2', 
        name: '儿童教育', 
        parentId: '', 
        icon: '/images/categories/kids.png', 
        categoryColor: '#0EA5E9', 
        sort: 2,
        bookCount: 203
      },
      { 
        _id: '3', 
        id: '3', 
        name: '家庭生活', 
        parentId: '', 
        icon: '/images/categories/family.png', 
        categoryColor: '#10B981', 
        sort: 3,
        bookCount: 178
      },
      { 
        _id: '4', 
        id: '4', 
        name: '文学经典', 
        parentId: '', 
        icon: '/images/categories/literature.png', 
        categoryColor: '#F59E0B', 
        sort: 4,
        bookCount: 245
      },
      { 
        _id: '5', 
        id: '5', 
        name: '职场技能', 
        parentId: '', 
        icon: '/images/categories/career.png', 
        categoryColor: '#6366F1', 
        sort: 5,
        bookCount: 189
      },
      { 
        _id: '6', 
        id: '6', 
        name: '科普知识', 
        parentId: '', 
        icon: '/images/categories/science.png', 
        categoryColor: '#EC4899', 
        sort: 6,
        bookCount: 132
      },
      { 
        _id: '7', 
        id: '7', 
        name: '旅游地理', 
        parentId: '', 
        icon: '/images/categories/travel.png', 
        categoryColor: '#EF4444', 
        sort: 7,
        bookCount: 97
      },
      { 
        _id: '8', 
        id: '8', 
        name: '财经商业', 
        parentId: '', 
        icon: '/images/categories/finance.png', 
        categoryColor: '#8B5CF6', 
        sort: 8,
        bookCount: 167
      }
    ];
    
    // 构建映射表
    const categoryIdMap = {};
    defaultCategories.forEach(category => {
      const categoryId = category.id;
      categoryIdMap[categoryId] = category;
      
      // 同时支持数字ID映射
      const numId = parseInt(categoryId);
      if (!isNaN(numId)) {
        categoryIdMap[numId] = category;
        categoryIdMap[numId.toString()] = category;
      }
    });
    
    this.setData({
      allCategories: defaultCategories,
      categoryIdMap: categoryIdMap
    });
    
    console.log('✅ 默认分类数据设置完成');
  },

  // 获取默认图标
  getDefaultIcon(categoryName) {
    const iconMap = {
      '历史': '🏛️',
      '人文': '🧑‍🤝‍🧑',
      '儿童': '🧒',
      '教育': '🎓',
      '家庭': '🏠',
      '生活': '🍳',
      '文学': '📚',
      '经典': '🎯',
      '职场': '💼',
      '技能': '🔧',
      '科普': '🔬',
      '知识': '🧠',
      '旅游': '✈️',
      '地理': '🗺️',
      '财经': '💰',
      '商业': '💼'
    };
    
    for (const key in iconMap) {
      if (categoryName.includes(key)) {
        return iconMap[key];
      }
    }
    
    return '📚';
  },

  // 获取默认颜色
  getDefaultColor(categoryName) {
    const colorMap = {
      '历史': '#6D28D9',
      '人文': '#8B5CF6',
      '儿童': '#0EA5E9',
      '教育': '#38BDF8',
      '家庭': '#10B981',
      '生活': '#34D399',
      '文学': '#F59E0B',
      '经典': '#FBBF24',
      '职场': '#6366F1',
      '技能': '#818CF8',
      '科普': '#EC4899',
      '知识': '#F472B6',
      '旅游': '#EF4444',
      '地理': '#F87171',
      '财经': '#8B5CF6',
      '商业': '#A78BFA'
    };
    
    for (const key in colorMap) {
      if (categoryName.includes(key)) {
        return colorMap[key];
      }
    }
    
    return '#1890ff';
  },

  // ============ 搜索功能 ============

  // 搜索输入
  onSearchInput: function(e) {
    const keyword = e.detail.value.trim();
    this.setData({
      searchKeyword: keyword,
      showFilters: false,
      showSearchResults: false
    });
    
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    
    if (!keyword) {
      this.clearSearchResults();
      return;
    }
    
    this.searchTimer = setTimeout(() => {
      if (keyword) {
        this.performSearch(keyword);
      }
    }, 500);
  },

  // 确认搜索
  onSearchConfirm: function(e) {
    const keyword = e.detail.value.trim();
    if (!keyword) return;
    
    this.performSearch(keyword);
  },

  // ✅ 修复：执行搜索（改进版）
  async performSearch(keyword) {
    if (!keyword || keyword.trim() === '') {
      this.clearSearchResults();
      return;
    }
    
    this.setData({
      isLoading: true,
      loadError: false,
      showFilters: false,
      showSearchResults: true,
      currentPage: 1
    });
    
    this.saveSearchHistory(keyword);
    
    try {
      console.log('🔍 开始搜索，关键词:', keyword);
      console.log('📊 当前分类映射表大小:', Object.keys(this.data.categoryIdMap).length);
      
      // 确保分类数据已加载
      if (Object.keys(this.data.categoryIdMap).length === 0) {
        console.log('⚠️ 分类数据未加载，等待加载...');
        await this.forceLoadAllCategories();
      }
      
      const result = await this.searchBooksFromCloud(keyword);
      
      console.log('📦 原始搜索结果数量:', result.books.length);
      
      // ✅ 修改：使用宽松匹配，显示更多结果
      const matchedBooks = this.filterBooks(result.books, keyword);
      
      console.log('✅ 匹配后数量:', matchedBooks.length);
      
      // ✅ 关键修复：处理书籍分类信息（使用映射表）
      const processedBooks = this.processBooksWithCategories(matchedBooks);
      
      console.log('🔍 处理后的书籍数据:', processedBooks.map(book => ({
        title: book.title,
        categoryId: book.categoryId,
        categoryName: book.categoryName
      })));
      
      // 提取筛选数据
      const filterData = this.extractFilterData(processedBooks);
      
      this.setData({
        searchResults: processedBooks,
        filteredResults: processedBooks,
        categoryTags: filterData.flatTags,
        categoryTree: filterData.categoryTree,
        totalResults: processedBooks.length,
        isLoading: false,
        hasMore: false,
        hasActiveFilters: false,
        showFilters: processedBooks.length > 0,
        selectedParentIds: [],
        selectedSubCategoryIds: [],
        expandedParentIds: []
      });
      
      console.log('🌳 分类树数据:', filterData.categoryTree);
      console.log('🏷️ 扁平标签:', filterData.flatTags);
      
      if (processedBooks.length === 0) {
        wx.showToast({
          title: '未找到相关结果',
          icon: 'none',
          duration: 2000
        });
      }
      
    } catch (error) {
      console.error('❌ 搜索失败:', error);
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: error.message || '搜索失败，请重试',
        showFilters: false,
        showSearchResults: true
      });
    }
  },

  // ✅ 修改：宽松匹配过滤
  filterBooks(books, keyword) {
    if (!Array.isArray(books) || !keyword) return [];
    
    // 将关键词转换为小写
    const lowerKeyword = keyword.toLowerCase().trim();
    
    // 如果关键词太短，直接返回所有结果
    if (lowerKeyword.length < 2) {
      console.log('📝 关键词太短，返回所有结果');
      return books;
    }
    
    return books.filter(book => {
      if (!book || typeof book !== 'object') {
        console.warn('⚠️ 无效的书籍数据:', book);
        return false;
      }
      
      // ✅ 修复：使用 String() 转换确保是字符串
      const title = String(book.title || '').toLowerCase();
      const author = String(book.author || '').toLowerCase();
      const description = String(book.description || '').toLowerCase();
      const category = String(book.categoryName || '').toLowerCase();
      
      // ✅ 修改：宽松匹配条件
      // 1. 标题包含关键词（完全匹配）
      if (title.includes(lowerKeyword)) {
        return true;
      }
      
      // 2. 作者包含关键词
      if (author.includes(lowerKeyword)) {
        return true;
      }
      
      // 3. 描述包含关键词
      if (description.includes(lowerKeyword)) {
        return true;
      }
      
      // 4. 分类包含关键词
      if (category.includes(lowerKeyword)) {
        return true;
      }
      
      // 5. 关键词包含在标题中（中文分词宽松匹配）
      if (lowerKeyword.length >= 2) {
        // 检查标题是否包含关键词的部分
        for (let i = 0; i < lowerKeyword.length - 1; i++) {
          const subKeyword = lowerKeyword.substring(i, i + 2);
          if (title.includes(subKeyword)) {
            return true;
          }
        }
      }
      
      return false;
    });
  },

  // ✅ 修复：处理书籍分类信息（使用映射表）
  processBooksWithCategories(books) {
    if (!Array.isArray(books)) return [];
    
    console.log('🔄 处理书籍分类信息，书籍数量:', books.length);
    console.log('📊 可用分类映射表键:', Object.keys(this.data.categoryIdMap));
    
    return books.map(book => {
      // ✅ 修复：确保书籍数据有效
      if (!book || typeof book !== 'object') {
        console.warn('⚠️ 无效的书籍数据:', book);
        return {
          ...book,
          title: String(book.title || '未知书籍'),
          categoryName: '未分类',
          categoryColor: '#1890ff',
          categoryIcon: '📚',
          categoryParentId: '',
          categoryParentName: ''
        };
      }
      
      let categoryInfo = null;
      const categoryId = book.categoryId;
      
      // ✅ 尝试多种方式查找分类信息
      if (categoryId) {
        // 1. 直接查找
        categoryInfo = this.data.categoryIdMap[categoryId];
        
        // 2. 如果没找到，尝试字符串转换
        if (!categoryInfo) {
          const strId = categoryId.toString();
          categoryInfo = this.data.categoryIdMap[strId];
        }
        
        // 3. 如果还没找到，尝试数字转换
        if (!categoryInfo && typeof categoryId === 'string') {
          const numId = parseInt(categoryId);
          if (!isNaN(numId)) {
            categoryInfo = this.data.categoryIdMap[numId];
            if (!categoryInfo) {
              categoryInfo = this.data.categoryIdMap[numId.toString()];
            }
          }
        }
        
        // 4. 如果仍然没找到，检查是不是数字ID在书籍表中
        if (!categoryInfo && typeof categoryId === 'number') {
          // 在分类表中查找对应的字符串ID
          const categoryEntries = Object.entries(this.data.categoryIdMap);
          for (const [key, cat] of categoryEntries) {
            const catNumId = parseInt(cat.id);
            if (!isNaN(catNumId) && catNumId === categoryId) {
              categoryInfo = cat;
              break;
            }
          }
        }
      }
      
      // ✅ 修复：确保书籍标题是字符串
      const bookTitle = String(book.title || '未知书籍');
      console.log(`📖 书籍 "${bookTitle}" 的分类ID: ${categoryId}, 找到分类:`, categoryInfo?.name || '未找到');
      
      // 获取分类信息
      const categoryName = categoryInfo ? categoryInfo.name : '未分类';
      const categoryColor = categoryInfo ? categoryInfo.categoryColor : '#1890ff';
      const categoryIcon = categoryInfo ? categoryInfo.icon : '📚';
      const parentId = categoryInfo ? categoryInfo.parentId : '';
      const parentName = parentId ? this.getCategoryNameById(parentId) : '';
      
      return {
        ...book,
        // ✅ 修复：确保书籍标题是字符串
        title: bookTitle,
        author: String(book.author || ''),
        description: String(book.description || ''),
        categoryName: categoryName,
        categoryColor: categoryColor,
        categoryIcon: categoryIcon,
        categoryParentId: parentId,
        categoryParentName: parentName
      };
    });
  },

  // 从云端搜索书籍
  async searchBooksFromCloud(keyword) {
    try {
      console.log('☁️ 调用云端搜索，关键词:', keyword);
      
      const result = await callCloud('book-service', {
        action: 'searchBooks',
        keyword: keyword,
        page: this.data.currentPage,
        pageSize: this.data.pageSize
      });
      
      console.log('☁️ 云端搜索响应:', {
        success: result?.success,
        dataLength: result?.data?.length || 0,
        total: result?.total
      });
      
      let books = [];
      let total = 0;
      
      if (result && result.success === true && result.data) {
        // ✅ 修复：检查 data 字段的实际内容
        if (result.data.list && Array.isArray(result.data.list)) {
          books = result.data.list;
          total = result.data.total || books.length;
          console.log('✅ 使用 data.list 格式');
        } else if (Array.isArray(result.data)) {
          books = result.data;
          total = result.total || books.length;
          console.log('✅ 使用 data 数组格式');
        } else {
          console.warn('⚠️ data 字段格式未知:', result.data);
          books = [];
          total = 0;
        }
      } else if (result && result.list) {
        books = result.list;
        total = result.total || books.length;
        console.log('✅ 使用旧格式 list 字段');
      } else if (Array.isArray(result)) {
        books = result;
        total = result.length;
        console.log('✅ 直接返回数组');
      } else if (result && result.books) {
        books = result.books;
        total = result.total || books.length;
        console.log('✅ 使用 books 字段');
      } else {
        console.warn('⚠️ 未知的数据格式:', result);
        books = [];
        total = 0;
      }
      
      // ✅ 修复：确保每本书都有基本字段
      const validatedBooks = books.map(book => {
        if (!book || typeof book !== 'object') {
          console.warn('⚠️ 无效的书籍数据:', book);
          return {
            _id: '',
            title: '未知书籍',
            author: '',
            description: '',
            categoryId: null,
            level: '初级',
            cover: '',
            likeCount: 0,
            commentCount: 0
          };
        }
        
        // 确保所有必需字段都有默认值
        return {
          _id: book._id || book.id || '',
          title: String(book.title || ''),
          author: String(book.author || ''),
          description: String(book.description || ''),
          categoryId: book.categoryId || null,
          level: book.level || '初级',
          cover: book.cover || '',
          likeCount: book.likeCount || 0,
          commentCount: book.commentCount || 0,
          popularity: book.popularity || 0,
          isRecommend: book.isRecommend || false,
          createTime: book.createTime || Date.now(),
          ...book // 保留其他字段
        };
      });
      
      console.log(`📚 解析到 ${validatedBooks.length} 本书籍`);
      
      return {
        books: validatedBooks,
        total: total
      };
      
    } catch (error) {
      console.error('❌ 云端搜索失败:', error);
      throw error;
    }
  },

  // 提取筛选数据
  extractFilterData(books) {
    if (!books || books.length === 0) {
      return { 
        flatTags: [],
        categoryTree: []
      };
    }
    
    console.log('🔄 提取筛选数据，书籍数量:', books.length);
    
    // 统计分类出现次数
    const categoryCount = {};
    books.forEach(book => {
      if (book.categoryId) {
        const categoryId = book.categoryId.toString();
        categoryCount[categoryId] = (categoryCount[categoryId] || 0) + 1;
      }
    });
    
    console.log('📊 分类统计:', categoryCount);
    
    // 构建分类树
    const allCategories = this.data.allCategories;
    const categoryTree = this.buildCategoryTree(allCategories, categoryCount);
    
    // 创建扁平化标签
    const flatTags = this.createFlatTags(categoryTree);
    
    return {
      flatTags: flatTags,
      categoryTree: categoryTree
    };
  },

  // 构建分类树
  buildCategoryTree(allCategories, categoryCount) {
    // 分离父分类和子分类
    const parentCategories = allCategories.filter(cat => !cat.parentId || cat.parentId === '');
    const childCategories = allCategories.filter(cat => cat.parentId && cat.parentId !== '');
    
    // 构建树形结构
    const categoryTree = parentCategories.map(parent => {
      // 获取子分类
      const children = childCategories
        .filter(child => {
          // 支持字符串和数字比较
          return child.parentId === parent.id || 
                 child.parentId === parent._id ||
                 child.parentId.toString() === parent.id.toString() ||
                 child.parentId.toString() === parent._id.toString();
        })
        .map(child => {
          // 统计数量（支持字符串和数字ID）
          let count = 0;
          const childId = child.id || child._id;
          if (childId) {
            count = categoryCount[childId] || 0;
            // 尝试数字版本
            const numId = parseInt(childId);
            if (!isNaN(numId)) {
              count += categoryCount[numId] || 0;
            }
          }
          
          return {
            ...child,
            count: count
          };
        });
      
      // 计算父分类的总数
      let totalCount = 0;
      const parentId = parent.id || parent._id;
      
      // 父分类自身的数量
      if (parentId) {
        totalCount += categoryCount[parentId] || 0;
        const numId = parseInt(parentId);
        if (!isNaN(numId)) {
          totalCount += categoryCount[numId] || 0;
        }
      }
      
      // 加上子分类的数量
      children.forEach(child => {
        totalCount += child.count || 0;
      });
      
      return {
        ...parent,
        count: totalCount,
        children: children.filter(child => (child.count || 0) > 0)
      };
    });
    
    // 过滤掉没有书籍的分类
    const filteredTree = categoryTree.filter(cat => 
      (cat.count || 0) > 0 || (cat.children && cat.children.length > 0)
    );
    
    // 按排序字段排序
    return filteredTree.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  },

  // 创建扁平化标签
  createFlatTags(categoryTree) {
    const flatTags = [];
    
    categoryTree.forEach(parent => {
      // 添加父分类
      if (parent.count > 0) {
        flatTags.push({
          id: parent.id || parent._id,
          name: parent.name,
          color: parent.categoryColor || this.getDefaultColor(parent.name),
          icon: parent.icon || this.getDefaultIcon(parent.name),
          count: parent.count,
          type: 'parent',
          parentId: null
        });
      }
      
      // 添加子分类
      if (parent.children && parent.children.length > 0) {
        parent.children.forEach(child => {
          if (child.count > 0) {
            flatTags.push({
              id: child.id || child._id,
              name: child.name,
              color: child.categoryColor || this.getDefaultColor(child.name),
              icon: child.icon || this.getDefaultIcon(child.name),
              count: child.count,
              type: 'child',
              parentId: parent.id || parent._id,
              parentName: parent.name
            });
          }
        });
      }
    });
    
    return flatTags;
  },

  // 根据ID获取分类名称
  getCategoryNameById(categoryId) {
    if (!categoryId) return '';
    
    // 尝试多种方式查找
    let category = this.data.categoryIdMap[categoryId];
    
    if (!category) {
      const strId = categoryId.toString();
      category = this.data.categoryIdMap[strId];
    }
    
    if (!category && typeof categoryId === 'string') {
      const numId = parseInt(categoryId);
      if (!isNaN(numId)) {
        category = this.data.categoryIdMap[numId];
        if (!category) {
          category = this.data.categoryIdMap[numId.toString()];
        }
      }
    }
    
    return category ? category.name : '';
  },

  // ============ 筛选功能 ============

  // 切换分类标签
  toggleCategory: function(e) {
    const categoryId = e.currentTarget.dataset.category;
    let activeCategories = [...this.data.activeCategories];
    
    const index = activeCategories.indexOf(categoryId);
    if (index === -1) {
      activeCategories.push(categoryId);
    } else {
      activeCategories.splice(index, 1);
    }
    
    this.setData({
      activeCategories: activeCategories,
      hasActiveFilters: activeCategories.length > 0 || 
                       this.data.activeDifficulty !== 'all' || 
                       this.data.activeSort !== 'relevance'
    });
    
    this.filterResults();
  },

  // 切换排序方式
  switchSort: function(e) {
    const sort = e.currentTarget.dataset.sort;
    this.setData({
      activeSort: sort,
      hasActiveFilters: true
    });
    
    this.filterResults();
  },

  // 切换难度级别
  switchDifficulty: function(e) {
    const difficulty = e.currentTarget.dataset.difficulty;
    this.setData({
      activeDifficulty: difficulty,
      hasActiveFilters: difficulty !== 'all'
    });
    
    this.filterResults();
  },

  // 过滤结果
  filterResults: function() {
    const { 
      searchResults,
      activeSort, 
      activeDifficulty, 
      activeCategories
    } = this.data;
    
    console.log('🔍 开始筛选，条件:', {
      difficulty: activeDifficulty,
      categories: activeCategories,
      sort: activeSort
    });
    
    let filteredBooks = [...searchResults];
    
    // 根据难度筛选
    if (activeDifficulty && activeDifficulty !== 'all') {
      filteredBooks = filteredBooks.filter(book => {
        return book.level === activeDifficulty;
      });
    }
    
    // 根据分类筛选
    if (activeCategories.length > 0) {
      filteredBooks = filteredBooks.filter(book => {
        if (!book.categoryId) return false;
        
        // 检查是否在选中的分类中
        const bookCategoryId = book.categoryId.toString();
        return activeCategories.includes(bookCategoryId) ||
               activeCategories.some(catId => catId.toString() === bookCategoryId);
      });
    }
    
    console.log('✅ 筛选后数量:', filteredBooks.length);
    
    // 排序
    let sortedResults = [...filteredBooks];
    
    if (activeSort === 'hot') {
      sortedResults = sortedResults.sort((a, b) => {
        const aScore = (a.likeCount || 0) + (a.popularity || 0);
        const bScore = (b.likeCount || 0) + (b.popularity || 0);
        return bScore - aScore;
      });
    } else if (activeSort === 'latest') {
      sortedResults = sortedResults.sort((a, b) => {
        const aTime = a.createTime || 0;
        const bTime = b.createTime || 0;
        return bTime - aTime;
      });
    } else if (activeSort === 'recommend') {
      sortedResults = sortedResults.sort((a, b) => {
        const aScore = (a.isRecommend ? 100 : 0) + (a.recommendWeight || 0);
        const bScore = (b.isRecommend ? 100 : 0) + (b.recommendWeight || 0);
        return bScore - aScore;
      });
    }
    
    this.setData({
      filteredResults: sortedResults
    });
  },

  // 清除所有筛选
  clearAllFilters: function() {
    this.setData({
      activeSort: 'relevance',
      activeDifficulty: 'all',
      activeCategories: [],
      selectedParentIds: [],
      selectedSubCategoryIds: [],
      expandedParentIds: [],
      hasActiveFilters: false
    });
    
    this.setData({
      filteredResults: this.data.searchResults
    });
  },

  // ============ 页面交互 ============

  goBack() {
    wx.navigateBack();
  },

  clearSearch() {
    this.setData({
      searchKeyword: '',
      searchResults: [],
      filteredResults: [],
      showFilters: false,
      showSearchResults: false,
      activeSort: 'relevance',
      activeDifficulty: 'all',
      activeCategories: [],
      selectedParentIds: [],
      selectedSubCategoryIds: [],
      expandedParentIds: [],
      hasActiveFilters: false,
      categoryTags: [],
      categoryTree: []
    });
  },

  clearSearchResults() {
    this.setData({
      searchResults: [],
      filteredResults: [],
      showFilters: false,
      showSearchResults: false,
      activeSort: 'relevance',
      activeDifficulty: 'all',
      activeCategories: [],
      selectedParentIds: [],
      selectedSubCategoryIds: [],
      expandedParentIds: [],
      hasActiveFilters: false,
      categoryTags: [],
      categoryTree: []
    });
  },

  onHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    if (!keyword) return;
    
    this.setData({
      searchKeyword: keyword,
      showFilters: false,
      showSearchResults: false
    });
    
    this.performSearch(keyword);
  },

  onHotKeywordTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    if (!keyword) return;
    
    this.setData({
      searchKeyword: keyword,
      showFilters: false,
      showSearchResults: false
    });
    
    this.performSearch(keyword);
  },

  retrySearch() {
    const keyword = this.data.searchKeyword;
    if (keyword) {
      this.performSearch(keyword);
    }
  },

  // ============ 搜索历史管理 ============

  saveSearchHistory(keyword) {
    if (!keyword || keyword.trim() === '') return;
    
    try {
      let history = wx.getStorageSync('searchHistory') || [];
      history = history.filter(item => item !== keyword);
      history.unshift(keyword);
      if (history.length > 10) {
        history = history.slice(0, 10);
      }
      
      wx.setStorageSync('searchHistory', history);
      this.setData({ searchHistory: history });
      
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  },

  loadSearchHistory() {
    try {
      const history = wx.getStorageSync('searchHistory') || [];
      this.setData({ searchHistory: history });
    } catch (error) {
      console.error('加载搜索历史失败:', error);
    }
  },

  clearSearchHistory() {
    wx.setStorageSync('searchHistory', []);
    this.setData({ searchHistory: [] });
    
    wx.showToast({
      title: '搜索历史已清空',
      icon: 'success',
      duration: 1500
    });
  },

  // ============ 页面导航 ============

  goToBook(e) {
    const id = e.currentTarget.dataset.id;
    const book = this.data.filteredResults.find(item => item._id === id);
    
    if (!book) return;
    
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${id}&title=${encodeURIComponent(book.title)}`
    });
  },

  // ============ 其他工具函数 ============

  getDifficultyClass: function(level) {
    const classMap = {
      '初级': 'level-beginner',
      '中级': 'level-intermediate',
      '高级': 'level-advanced',
      '入门': 'level-entry',
      '进阶': 'level-progress',
      '专业': 'level-professional'
    };
    return classMap[level] || 'level-intermediate';
  },

  getCategoryColor: function(categoryId) {
    if (!categoryId) return '#1890ff';
    
    // 尝试多种方式查找
    let category = this.data.categoryIdMap[categoryId];
    
    if (!category) {
      const strId = categoryId.toString();
      category = this.data.categoryIdMap[strId];
    }
    
    if (!category && typeof categoryId === 'string') {
      const numId = parseInt(categoryId);
      if (!isNaN(numId)) {
        category = this.data.categoryIdMap[numId];
        if (!category) {
          category = this.data.categoryIdMap[numId.toString()];
        }
      }
    }
    
    return category ? category.categoryColor : '#1890ff';
  },

  getCategoryIcon: function(categoryId) {
    if (!categoryId) return '📚';
    
    // 尝试多种方式查找
    let category = this.data.categoryIdMap[categoryId];
    
    if (!category) {
      const strId = categoryId.toString();
      category = this.data.categoryIdMap[strId];
    }
    
    if (!category && typeof categoryId === 'string') {
      const numId = parseInt(categoryId);
      if (!isNaN(numId)) {
        category = this.data.categoryIdMap[numId];
        if (!category) {
          category = this.data.categoryIdMap[numId.toString()];
        }
      }
    }
    
    return category ? category.icon : '📚';
  },

  // ============ 页面生命周期 ============

  onShareAppMessage: function() {
    const keyword = this.data.searchKeyword;
    const title = keyword ? `搜索"${keyword}" - 英语听书` : '英语听书 - 搜索';
    
    return {
      title: title,
      path: '/pages/search/search'
    };
  },

  onUnload: function() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }
});