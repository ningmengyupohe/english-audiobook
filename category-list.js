// category-list.js
// 导入云函数工具
const { callCloud, cloudAPI } = require('../../utils/uni-cloud');

Page({
  data: {
    categoryId: '',
    categoryName: '',
    categoryInfo: {}, // 存储分类详细信息
    bookList: [],
    currentPage: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,
    
    // 筛选参数
    filterIndex: 0,
    filterOptions: [
      { name: '最热', value: 'popularity', order: 'desc' },
      { name: '最新', value: 'createTime', order: 'desc' },
      { name: '推荐', value: 'recommendWeight', order: 'desc' }
    ],
    
    // 难度筛选（匹配数据库中的level字段）
    showFilterModal: false,
    selectedLevel: '', // 对应book-info表的level字段
    minDuration: '',
    maxDuration: '',
    
    levelOptions: [
      { label: '初级', value: '初级' },
      { label: '中级', value: '中级' },
      { label: '高级', value: '高级' }
    ],
    
    // 播放相关
    currentPlayingBook: null,
    isPlaying: false,
    audioContext: null,
    
    // 错误处理
    loadError: false,
    errorMessage: '',
    
    // 统计信息
    totalBooks: 0,
    totalPages: 0,
    hotBooks: [], // 热门书籍（从分类详情获取）
    subCategories: [] // 子分类
  },

  onLoad: function(options) {
    const categoryId = options.categoryId || ''
    const categoryName = decodeURIComponent(options.categoryName || '')
    const bookCount = parseInt(options.bookCount) || 0
    
    console.log('分类列表页面参数:', { categoryId, categoryName, bookCount })
    
    if (!categoryId) {
      wx.showToast({
        title: '参数错误',
        icon: 'none',
        duration: 2000
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    this.setData({
      categoryId,
      categoryName,
      totalBooks: bookCount
    })
    
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: categoryName || '加载中...'
    })
    
    // 加载数据
    this.loadData()
    
    // 初始化音频
    this.initAudio()
  },

  onUnload: function() {
    if (this.data.audioContext) {
      this.data.audioContext.destroy()
    }
  },

  onPullDownRefresh: function() {
    console.log('下拉刷新')
    this.loadData(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom: function() {
    console.log('滚动到底部，加载更多')
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMoreBooks()
    }
  },

  // ============ 数据加载函数 ============

  // 加载所有数据
  async loadData(refresh = false) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })
    
    try {
      await Promise.all([
        this.loadCategoryDetail(),
        this.loadBooks(true) // 第一页
      ])
      
      wx.hideLoading()
      
      if (refresh) {
        wx.showToast({
          title: '刷新成功',
          icon: 'success',
          duration: 1500
        })
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      wx.hideLoading()
      
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 加载分类详情
  async loadCategoryDetail() {
    try {
      console.log('开始加载分类详情...')
      
      const result = await callCloud('book-service', {
        action: 'getCategoryDetail',
        categoryId: this.data.categoryId
      })
      
      console.log('分类详情响应:', result)
      
      // 🚨 修复：根据实际响应结构处理数据
      // 从日志看，响应是直接返回数据对象：{_id: "2", name: "儿童教育", ...}
      let categoryData = result;
      
      // 检查是否是标准格式 {success: true, data: {...}}
      if (result && result.success === true) {
        categoryData = result.data;
      }
      // 检查是否是 {code: 0, success: true, data: {...}}
      else if (result && result.code === 0) {
        categoryData = result.data;
      }
      // 否则直接使用 result
      
      if (!categoryData) {
        console.warn('分类详情数据为空')
        throw new Error('获取分类详情失败')
      }
      
      const categoryInfo = {
        _id: categoryData._id || this.data.categoryId,
        name: categoryData.name || this.data.categoryName,
        enName: categoryData.enName,
        icon: categoryData.icon,
        bgImage: categoryData.bgImage,
        description: categoryData.description,
        difficulty: categoryData.difficulty,
        gradient: categoryData.gradient,
        categoryColor: categoryData.categoryColor,
        isHot: categoryData.isHot,
        isRecommend: categoryData.isRecommend,
        bookCount: categoryData.bookCount || this.data.totalBooks
      }
      
      this.setData({
        categoryInfo,
        hotBooks: categoryData.hotBooks || [],
        subCategories: categoryData.subCategories || [],
        // 更新总书籍数
        totalBooks: categoryData.bookCount || this.data.totalBooks
      })
      
      // 更新页面标题
      wx.setNavigationBarTitle({
        title: categoryInfo.name
      })
      
      console.log('分类详情加载成功:', categoryInfo)
      
      return categoryInfo
      
    } catch (error) {
      console.error('加载分类详情失败:', error)
      throw error
    }
  },

  // 加载书籍列表
  async loadBooks(refresh = false) {
    if (this.data.isLoading) return
    
    const page = refresh ? 1 : this.data.currentPage
    
    this.setData({ 
      isLoading: true,
      loadError: false 
    })
    
    try {
      console.log(`开始加载书籍列表，第${page}页`)
      
      // 获取当前筛选条件
      const currentFilter = this.data.filterOptions[this.data.filterIndex]
      
      // 构建请求参数
      const params = {
        action: 'getBooksByCategory',
        categoryId: this.data.categoryId,
        page: page,
        pageSize: this.data.pageSize
      }
      
      // 添加排序
      if (currentFilter.value === 'popularity') {
        params.sortBy = 'popularity'
        params.order = 'desc'
      } else if (currentFilter.value === 'createTime') {
        params.sortBy = 'createTime'
        params.order = 'desc'
      } else if (currentFilter.value === 'recommendWeight') {
        params.sortBy = 'recommendWeight'
        params.order = 'desc'
      }
      
      // 添加难度筛选（对应数据库的level字段）
      if (this.data.selectedLevel) {
        params.level = this.data.selectedLevel
      }
      
      console.log('书籍列表请求参数:', params)
      
      const result = await callCloud('book-service', params)
      
      console.log('书籍列表响应:', result)
      
      // 🚨 修复：根据实际响应结构处理数据
      let response = result;
      
      // 检查是否是标准格式 {success: true, data: {...}}
      if (result && result.success === true) {
        response = result.data || result;
      }
      // 检查是否是 {code: 0, success: true, data: {...}}
      else if (result && result.code === 0) {
        response = result.data || result;
      }
      // 如果是 {list: [...], pagination: {...}} 格式
      else if (result && result.list !== undefined) {
        response = result;
      }
      
      if (!response) {
        console.warn('书籍列表响应为空')
        this.setData({
          loadError: true,
          errorMessage: '获取书籍列表失败'
        })
        return []
      }
      
      let books = []
      let pagination = {}
      let categoryInfo = {}
      
      // 处理不同的响应格式
      if (response.list && Array.isArray(response.list)) {
        books = response.list
        pagination = response.pagination || {}
        categoryInfo = response.categoryInfo || {}
      } else if (Array.isArray(response)) {
        books = response
      } else {
        books = []
      }
      
      // 如果从响应中获取到分类信息，更新一下
      if (categoryInfo && categoryInfo.name) {
        this.setData({
          categoryInfo: {
            ...this.data.categoryInfo,
            ...categoryInfo
          }
        })
      }
      
      // 格式化书籍数据
      const formattedBooks = this.formatBooks(books)
      
      // 处理分页
      const hasMore = books.length === this.data.pageSize
      
      if (refresh) {
        this.setData({
          bookList: formattedBooks,
          currentPage: 1,
          hasMore: hasMore,
          totalPages: pagination.totalPages || Math.ceil((pagination.total || 0) / this.data.pageSize)
        })
      } else {
        this.setData({
          bookList: [...this.data.bookList, ...formattedBooks],
          currentPage: page + 1,
          hasMore: hasMore
        })
      }
      
      console.log(`加载了 ${books.length} 本书籍，还有更多: ${hasMore}`)
      
      return formattedBooks
      
    } catch (error) {
      console.error('加载书籍列表失败:', error)
      this.setData({
        loadError: true,
        errorMessage: error.message || '网络请求失败'
      })
      
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      })
      
      throw error
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 加载更多书籍
  async loadMoreBooks() {
    if (!this.data.hasMore) {
      console.log('没有更多数据了')
      return
    }
    
    console.log('加载更多书籍，当前页:', this.data.currentPage)
    
    try {
      const books = await this.loadBooks(false)
      
      if (books.length > 0) {
        wx.showToast({
          title: `加载了${books.length}本`,
          icon: 'none',
          duration: 1000
        })
      }
    } catch (error) {
      console.error('加载更多失败:', error)
    }
  },

  // 格式化书籍数据
  formatBooks(books) {
    if (!Array.isArray(books)) return []
    
    return books.map(book => {
      const totalDuration = book.totalDuration || 0
      const durationMinutes = Math.floor(totalDuration / 60)
      
      return {
        id: book._id || book.id,
        _id: book._id || book.id,
        title: book.title || '未命名书籍',
        subtitle: book.subtitle,
        author: book.author || '未知作者',
        cover: book.cover || '/images/covers/default.jpg',
        description: book.description || '暂无简介',
        categoryId: book.categoryId,
        level: book.level || '中级',
        totalChapters: book.totalChapters || 0,
        totalDuration: totalDuration,
        duration: durationMinutes, // 以分钟显示
        likeCount: book.likeCount || 0,
        commentCount: book.commentCount || 0,
        status: book.status || '完结',
        popularity: book.popularity || 0,
        // 推荐相关
        isRecommend: book.isRecommend || false,
        recommendBadge: book.recommendBadge || '',
        recommendReason: book.recommendReason || '',
        recommendType: book.recommendType || [],
        // 创建时间
        createTime: book.createTime,
        // 格式化后的字段
        difficulty: book.level || '中级',
        playCount: Math.floor((book.popularity || 0) / 10), // 根据热度模拟播放次数
        isFavorite: false // 默认未收藏，需要从用户收藏表查询
      }
    })
  },

  // ============ 筛选相关函数 ============

  changeFilter: function(e) {
    const filterIndex = parseInt(e.currentTarget.dataset.index)
    
    if (filterIndex === this.data.filterIndex) return
    
    const filterName = this.data.filterOptions[filterIndex].name
    
    wx.showToast({
      title: `切换为${filterName}`,
      icon: 'none',
      duration: 1000
    })
    
    this.setData({ 
      filterIndex: filterIndex,
      currentPage: 1,
      bookList: []
    })
    
    // 重新加载数据
    this.loadBooks(true)
  },

  showMoreFilter: function() {
    this.setData({ showFilterModal: true })
  },

  hideFilterModal: function() {
    this.setData({ showFilterModal: false })
  },

  selectLevel: function(e) {
    const value = e.currentTarget.dataset.value
    const newValue = this.data.selectedLevel === value ? '' : value
    
    this.setData({
      selectedLevel: newValue
    })
    
    if (newValue) {
      const selectedOption = this.data.levelOptions.find(opt => opt.value === newValue)
      console.log('选择难度:', selectedOption?.label)
    }
  },

  removeFilter: function(e) {
    const type = e.currentTarget.dataset.type
    
    if (type === 'difficulty') {
      this.setData({ selectedLevel: '' })
    } else if (type === 'minDuration') {
      this.setData({ minDuration: '' })
    } else if (type === 'maxDuration') {
      this.setData({ maxDuration: '' })
    }
    
    // 重新加载数据
    setTimeout(() => {
      this.loadBooks(true)
    }, 300)
  },

  resetFilters: function() {
    this.setData({
      selectedLevel: '',
      minDuration: '',
      maxDuration: ''
    })
    
    // 重新加载数据
    setTimeout(() => {
      this.loadBooks(true)
    }, 300)
  },

  applyFilters: function() {
    this.hideFilterModal()
    
    // 显示筛选信息
    let filterInfo = []
    if (this.data.selectedLevel) {
      const level = this.data.levelOptions.find(opt => opt.value === this.data.selectedLevel)
      filterInfo.push(level?.label || this.data.selectedLevel)
    }
    if (this.data.minDuration) {
      filterInfo.push(`时长≥${this.data.minDuration}分钟`)
    }
    if (this.data.maxDuration) {
      filterInfo.push(`时长≤${this.data.maxDuration}分钟`)
    }
    
    if (filterInfo.length > 0) {
      wx.showToast({
        title: `筛选: ${filterInfo.join('，')}`,
        icon: 'none',
        duration: 2000
      })
    }
    
    // 重新加载数据
    this.loadBooks(true)
  },

  // ============ 其他功能函数 ============

  initAudio: function() {
    const audioContext = wx.createInnerAudioContext()
    
    audioContext.onPlay(() => {
      console.log('开始播放')
      this.setData({ isPlaying: true })
    })
    
    audioContext.onPause(() => {
      console.log('暂停播放')
      this.setData({ isPlaying: false })
    })
    
    audioContext.onEnded(() => {
      console.log('播放结束')
      this.setData({ isPlaying: false })
    })
    
    audioContext.onError((res) => {
      console.error('音频播放错误:', res)
      wx.showToast({
        title: '播放失败',
        icon: 'none'
      })
    })
    
    this.setData({ audioContext })
  },

  goBack: function() {
    wx.navigateBack()
  },

  goToBookDetail: function(e) {
    const bookId = e.currentTarget.dataset.id
    const book = this.data.bookList.find(b => b.id === bookId)
    
    if (!book) {
      wx.showToast({
        title: '书籍不存在',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${bookId}&title=${encodeURIComponent(book.title)}`
    })
  },

  toggleFavorite: async function(e) {
    e.stopPropagation()
    const bookId = e.currentTarget.dataset.id
    
    try {
      // 检查是否已登录
      const token = wx.getStorageSync('token')
      if (!token) {
        wx.showToast({
          title: '请先登录',
          icon: 'none',
          duration: 2000
        })
        return
      }
      
      // 调用收藏API
      const result = await callCloud('shelf-service', {
        action: 'check',
        bookId: bookId
      })
      
      if (result && result.success === true) {
        const isInShelf = result.data || false
        
        if (isInShelf) {
          // 从书架移除
          await callCloud('shelf-service', {
            action: 'remove',
            bookId: bookId
          })
          
          wx.showToast({
            title: '已取消收藏',
            icon: 'success',
            duration: 1000
          })
        } else {
          // 添加到书架
          await callCloud('shelf-service', {
            action: 'add',
            bookId: bookId
          })
          
          wx.showToast({
            title: '已收藏',
            icon: 'success',
            duration: 1000
          })
        }
        
        // 更新本地状态
        const bookList = this.data.bookList.map(book => {
          if (book.id === bookId) {
            return { ...book, isFavorite: !isInShelf }
          }
          return book
        })
        
        this.setData({ bookList })
        
      } else {
        throw new Error(result?.message || '操作失败')
      }
      
    } catch (error) {
      console.error('收藏操作失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none',
        duration: 2000
      })
    }
  },

  playBook: async function(e) {
    e.stopPropagation()
    const bookId = e.currentTarget.dataset.id
    const book = this.data.bookList.find(b => b.id === bookId)
    
    if (!book) {
      wx.showToast({
        title: '书籍不存在',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 先跳转到播放页面，由播放页面处理具体播放逻辑
    wx.navigateTo({
      url: `/pages/player/player?bookId=${bookId}`
    })
  },

  // ============ 页面分享 ============

  onShareAppMessage: function() {
    const categoryName = this.data.categoryInfo.name || this.data.categoryName
    
    return {
      title: `${categoryName} - 英语听书分类`,
      path: `/pages/category-list/category-list?categoryId=${this.data.categoryId}&categoryName=${encodeURIComponent(categoryName)}`,
      imageUrl: this.data.categoryInfo.bgImage || '/images/share/category.jpg'
    }
  },

  onShareTimeline: function() {
    const categoryName = this.data.categoryInfo.name || this.data.categoryName
    
    return {
      title: `${categoryName} - 英语听书分类`,
      query: `categoryId=${this.data.categoryId}&categoryName=${encodeURIComponent(categoryName)}`,
      imageUrl: this.data.categoryInfo.bgImage || '/images/share/category.jpg'
    }
  }
})