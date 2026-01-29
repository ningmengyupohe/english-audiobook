/**
 * uniCloud 云函数调用封装
 * 注意：需要在uniCloud控制台为每个云函数设置PATH
 * 例如：book-service 的 PATH 设置为 /api/book
 */

// uniCloud URL化域名（不要以 / 结尾）
const CLOUD_BASE_URL = 'https://fc-mp-22bc083a-75be-471b-a448-e1e547b31823.next.bspapp.com'

// 云函数名到PATH的映射（根据你在uniCloud控制台的设置）
const FUNCTION_PATH_MAP = {
  // 书籍服务
  'book-service': '/api/book',
  
  // 用户服务  
  'user-service': '/api/user',
  
  // 章节服务
  'chapter-service': '/api/chapter',
  
  // 书架服务
  'shelf-service': '/api/shelf',
  
  // 播放服务
  'player-service': '/api/player',
  
  // 游戏服务
  'game-service': '/api/game',
  
  // 社交服务
  'social-service': '/api/social',
  
  // 通用服务
  'common': '/api/common',

  // 🆕 学习服务（纯爬取版）
  'study-service': '/api/study'
}

/**
 * 初始化uniCloud（兼容性方法）
 */
const initCloud = (baseUrl) => {
  if (baseUrl) {
    console.log('uniCloud URL已更新:', baseUrl)
  }
  console.log('当前uniCloud地址:', CLOUD_BASE_URL)
}

/**
 * 获取请求头 - 🚨 修复token获取逻辑
 */
const getHeaders = () => {
    try {
      console.log('🔍 getHeaders开始执行...');
      
      // 🚨 关键修复：尝试多种方式获取token
      let token = null;
      let tokenSource = 'unknown';
      
      // 方式1：直接从本地存储获取
      token = wx.getStorageSync('token');
      if (token) {
        tokenSource = 'storage';
      } else {
        // 方式2：从getApp的globalData获取
        const app = getApp();
        if (app && app.globalData && app.globalData.token) {
          token = app.globalData.token;
          tokenSource = 'globalData';
        } else {
          // 方式3：尝试从userInfo中获取
          const userInfo = wx.getStorageSync('userInfo');
          if (userInfo && userInfo.token) {
            token = userInfo.token;
            tokenSource = 'userInfo.token';
          }
        }
      }
      
      console.log('🔍 Token获取详情:', {
        是否存在: !!token,
        获取来源: tokenSource,
        token前20位: token ? token.substring(0, 20) + '...' : '空',
        token长度: token ? token.length : 0
      });
      
      // 🚨 调试：检查所有可能的存储位置
      const debugToken = wx.getStorageSync('token');
      const debugUserInfo = wx.getStorageSync('userInfo');
      const app = getApp();
      const debugGlobalToken = app && app.globalData && app.globalData.token;
      
      console.log('🔍 所有存储位置检查:', {
        'wx.getStorageSync("token")': debugToken ? debugToken.substring(0, 20) + '...' : '空',
        'wx.getStorageSync("userInfo")': debugUserInfo ? JSON.stringify(debugUserInfo).substring(0, 50) + '...' : '空',
        'getApp().globalData.token': debugGlobalToken ? debugGlobalToken.substring(0, 20) + '...' : '空'
      });
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };
      
      if (token) {
        // 🚨 确保token格式正确
        let authToken = token;
        
        // 如果token已经包含Bearer前缀，不再重复添加
        if (authToken.startsWith('Bearer ')) {
          headers['Authorization'] = authToken;
        } else {
          // 如果没有Bearer前缀，则添加
          headers['Authorization'] = 'Bearer ' + authToken;
        }
        
        console.log('🔧 最终Authorization头:', headers['Authorization'].substring(0, 30) + '...');
      } else {
        console.log('⚠️ 所有token来源都为空，请求将不带Authorization头');
      }
      
      return headers;
    } catch (error) {
      console.error('❌ 获取请求头失败:', error);
      
      // 🚨 返回基础headers，确保请求能发出
      return {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };
    }
  };

/**
 * 检查是否是登录过期错误 - 🚨 修复误判逻辑
 */
const isLoginExpiredError = (error) => {
  const message = error.message || ''
  const code = error.code || error.status
  
  console.log('🔍 检查登录错误:', { code, message })
  
  // 🚨 关键修复：更精确的检测逻辑
  return (
    code === 401 || 
    (message.includes('登录过期') || 
     message.includes('token过期') ||
     message.includes('认证失败') ||
     (message.includes('未登录') && code === 401)) // 只有401状态码的"未登录"才清除
  )
}

/**
 * 清除登录状态
 */
const clearLoginState = () => {
  try {
    console.log('⚠️ 清除登录状态')
    const app = getApp()
    
    // 清除本地存储
    wx.removeStorageSync('token')
    wx.removeStorageSync('userInfo')
    
    // 清除全局数据
    if (app && app.globalData) {
      app.globalData.token = null
      app.globalData.userInfo = null
    }
    
    console.log('✅ 登录状态已清除')
    return true
  } catch (error) {
    console.error('清除登录状态失败:', error)
    return false
  }
}

/**
 * 处理API响应 - 🚨 修复登录响应处理
 */
const handleResponse = (response) => {
  console.log('处理API响应，原始数据:', response)
  
  // 🚨 新增：特殊处理"请先登录"错误（不立即清除登录状态）
  if (response && response.code === 500 && response.message === "请先登录") {
    console.log('🔍 检测到服务端登录验证失败，但不一定是token过期')
    return {
      code: response.code,
      success: false,
      data: response.data,
      message: response.message,
      isLoginError: true  // 🚨 添加标记，让调用方决定是否清除登录状态
    }
  }
  
  // 🚨 关键修复：首先检查是否是登录响应（直接包含 userInfo 和 token）
  if (response && (response.userInfo !== undefined || response.token !== undefined)) {
    console.log('检测到登录响应格式')
    return response // 直接返回，不包装
  }
  
  // 如果响应本身就是 data 字段的内容
  if (response && (response._id || response.id || response.username)) {
    console.log('检测到直接返回的用户数据')
    return {
      code: 0,
      success: true,
      data: response,
      message: '成功'
    }
  }
  
  // 如果响应包含 code 字段
  if (response && response.code !== undefined) {
    console.log('检测到标准响应格式')
    // 确保返回标准格式
    return {
      code: response.code,
      success: response.code === 0 || response.code === 200 || response.success === true,
      data: response.data || response,
      message: response.message || response.msg || (response.code === 0 ? '成功' : '请求失败')
    }
  }
  
  // 如果响应包含 success 字段
  if (response && response.success !== undefined) {
    console.log('检测到 success 响应格式')
    return {
      code: response.success ? 0 : -1,
      success: response.success,
      data: response.data || response,
      message: response.message || response.msg || (response.success ? '成功' : '请求失败')
    }
  }
  
  // 默认认为是成功响应
  console.log('检测到直接数据格式，包装为标准格式')
  return {
    code: 0,
    success: true,
    data: response,
    message: '成功'
  }
}

/**
 * 调用云函数 - 🚨 修复请求数据格式
 * @param {string} functionName - 云函数名称
 * @param {object} data - 请求数据
 * @returns {Promise}
 */
const callCloud = (functionName, data = {}) => {
  // 🚨 关键调试：检查传入的参数
  console.log('🚨 ========== callCloud 调用开始 ==========')
  console.log('📋 调用函数:', functionName)
  console.log('📋 传入的 data 对象:', JSON.stringify(data, null, 2))
  console.log('🔍 检查 data.action:', 'action' in data ? `存在，值为: "${data.action}"` : '不存在')
  console.log('🔍 data 所有属性:', Object.keys(data).join(', '))
  
  // 获取PATH映射
  const path = FUNCTION_PATH_MAP[functionName]
  
  if (!path) {
    console.error(`❌ 未找到函数 ${functionName} 的PATH映射`)
    console.warn('请在FUNCTION_PATH_MAP中添加映射，或在uniCloud控制台设置PATH')
    return Promise.reject(new Error(`未配置函数 ${functionName}`))
  }
  
  const url = CLOUD_BASE_URL + path
  console.log('🌐 请求URL:', url)
  
  // 🚨 调试：检查请求头和token
  const headers = getHeaders();
  
  console.log(`📤 完整请求信息:`, {
    函数名: functionName,
    URL: url,
    请求数据: data,
    请求头: headers,
    Authorization头: headers['Authorization'] ? headers['Authorization'].substring(0, 30) + '...' : '空'
  });
  
  // 🚨 关键：构建请求数据
  const requestData = {
    ...data,
    _timestamp: Date.now(),
    _platform: 'miniprogram'
  };
  
  console.log('📦 最终的请求数据:', JSON.stringify(requestData, null, 2))
  console.log('🔍 最终请求数据中的action:', requestData.action)
  console.log('🚨 ========== callCloud 调用结束 ==========')
  
  return new Promise((resolve, reject) => {
    // 🚨 关键修复：直接发送JSON字符串
    wx.request({
      url: url,
      method: 'POST',
      // 🚨 重要：直接发送JSON字符串，而不是对象
      data: JSON.stringify(requestData),
      header: headers,
      timeout: 15000,
      success: (res) => {
        console.log(`✅ ${functionName} 响应:`, {
          状态码: res.statusCode,
          响应头: res.header,
          响应数据: res.data
        })
        
        if (res.statusCode === 200) {
          try {
            // 处理响应数据，适配各种格式
            const processedResponse = handleResponse(res.data)
            console.log('处理后的响应:', processedResponse)
            
            // 🚨 修复：检查是否是登录成功响应
            if (processedResponse.userInfo || processedResponse.token) {
              console.log('✅ 登录成功，直接返回')
              resolve(processedResponse)
            } 
            // 🚨 新增：检查是否是500错误但包含登录错误标记
            else if (processedResponse.code === 500 && processedResponse.isLoginError) {
              console.log('⚠️ 登录验证失败，返回错误但不清除登录状态')
              const error = new Error(processedResponse.message)
              error.code = processedResponse.code
              error.isLoginError = true
              reject(error)
            }
            else if (processedResponse.success || processedResponse.code === 0) {
              // 业务成功响应
              resolve(processedResponse.data || processedResponse)
            } else {
              // 业务错误
              const error = new Error(processedResponse.message || '业务处理失败')
              error.code = processedResponse.code || 'BUSINESS_ERROR'
              error.data = processedResponse.data
              
              // 🚨 修改：只有确认是登录过期错误才清除登录状态
              if (isLoginExpiredError(error)) {
                console.log('🔍 确认是登录过期错误，清除登录状态')
                clearLoginState()
              } else {
                console.log('🔍 不是登录过期错误，不清除登录状态')
              }
              
              reject(error)
            }
          } catch (error) {
            console.error('处理响应数据失败:', error)
            reject(new Error('响应数据格式错误'))
          }
        } else {
          // HTTP错误
          const error = new Error(`HTTP ${res.statusCode}`)
          error.status = res.statusCode
          error.data = res.data
          
          console.log('HTTP错误详情:', error)
          
          // 🚨 修改：只有确认是登录过期错误才清除登录状态
          if (isLoginExpiredError(error)) {
            console.log('🔍 HTTP错误中检测到登录过期，清除登录状态')
            clearLoginState()
          }
          
          reject(error)
        }
      },
      fail: (err) => {
        console.error(`❌ ${functionName} 请求失败:`, err)
        
        const error = new Error(err.errMsg || '网络请求失败')
        error.code = 'NETWORK_ERROR'
        error.errMsg = err.errMsg
        reject(error)
      }
    })
  })
}

/**
 * 🚨 新增：调试请求函数
 */
const debugCallCloud = (functionName, data = {}) => {
  return new Promise((resolve, reject) => {
    console.log('🔍 === 调试API调用开始 ===');
    
    // 获取PATH映射
    const path = FUNCTION_PATH_MAP[functionName]
    const url = CLOUD_BASE_URL + path
    
    // 检查本地token
    const token = wx.getStorageSync('token');
    console.log('🔍 调试信息:', {
      本地token: token ? token.substring(0, 30) + '...' : '空',
      本地token长度: token ? token.length : 0,
      本地token是否包含Bearer: token ? (token.startsWith('Bearer ') ? '是' : '否') : '空',
      函数名: functionName,
      URL: url,
      数据: data
    });
    
    // 构建请求头
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    if (token) {
      // 🚨 修复：正确的token处理
      let authToken = token;
      if (authToken.startsWith('Bearer ')) {
        headers['Authorization'] = authToken;
      } else {
        headers['Authorization'] = 'Bearer ' + authToken;
      }
      console.log('🔧 最终Authorization头:', headers['Authorization'].substring(0, 30) + '...');
    }
    
    console.log('📤 发送请求:', {
      headers: headers,
      data: data
    });
    
    wx.request({
      url: url,
      method: 'POST',
      // 🚨 关键：直接发送JSON字符串
      data: JSON.stringify({
        ...data,
        _timestamp: Date.now(),
        _platform: 'miniprogram'
      }),
      header: headers,
      timeout: 10000,
      success: (res) => {
        console.log('✅ 调试请求成功:', {
          状态码: res.statusCode,
          响应头: res.header,
          响应数据: res.data
        });
        
        // 特别检查Authorization头
        if (res.header) {
          console.log('📋 响应头详情:');
          for (let key in res.header) {
            if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')) {
              console.log(`  ${key}: ${res.header[key].substring(0, 30) + '...'}`);
            }
          }
        }
        
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          const error = new Error(`HTTP ${res.statusCode}`);
          error.status = res.statusCode;
          error.data = res.data;
          reject(error);
        }
      },
      fail: (err) => {
        console.error('❌ 调试请求失败:', err);
        reject(err);
      }
    });
  });
};

/**
 * 云函数业务接口封装
 */
const cloudAPI = {
  // ============ 用户服务 ============
  user: {
    /**
     * 用户登录
     * @param {object} data - {phone, password} 或 {username, password}
     */
    login: (data) => callCloud('user-service', { 
      action: 'login', 
      ...data 
    }),
    
    /**
     * 用户注册
     * @param {object} data - {username, password, phone, email, ...}
     */
    register: (data) => callCloud('user-service', { 
      action: 'register', 
      ...data 
    }),
    
    /**
     * 获取用户信息
     */
    getInfo: () => callCloud('user-service', { 
      action: 'getUserInfo' 
    }),
    
    /**
     * 更新用户信息
     * @param {object} data - 用户信息
     */
    updateInfo: (data) => callCloud('user-service', { 
      action: 'updateProfile', 
      ...data 
    }),
    
    /**
     * 退出登录
     */
    logout: () => callCloud('user-service', { 
      action: 'logout' 
    }),
    
    /**
     * 获取用户统计数据（学习数据）
     */
    getStats: () => callCloud('user-service', {
      action: 'getStats'
    }),
    
    /**
     * 获取用户书籍统计
     */
    getBookStats: () => callCloud('user-service', {
      action: 'getBookStats'
    }),
    
    /**
     * 获取用户完整信息（用于个人主页）
     */
    getProfile: () => callCloud('user-service', {
      action: 'getProfile'
    }),
    
    /**
     * 更新头像
     * @param {string} avatarUrl - 头像URL
     */
    updateAvatar: (avatarUrl) => callCloud('user-service', {
      action: 'updateAvatar',
      avatar: avatarUrl
    }),
    
    /**
     * 更新昵称
     * @param {string} nickname - 新昵称
     */
    updateNickname: (nickname) => callCloud('user-service', {
      action: 'updateNickname',
      nickname: nickname
    }),
    
    /**
     * 🚨 新增：调试检查token
     */
    debugCheckToken: (data) => callCloud('user-service', {
      action: 'debugCheckToken',
      ...data
    }),
    
    /**
     * 🚨 新增：调试调用
     */
    debugGetInfo: () => debugCallCloud('user-service', {
      action: 'getUserInfo'
    })
  },
  
  // ============ 书籍服务 ============
  book: {
    /**
     * 🚨 新增：获取我的收藏
     * @param {object} params - {userId, page, pageSize}
     */
    getMyFavorites: (params) => callCloud('book-service', {
      action: 'getMyFavorites',
      ...params
    }),
    
    /**
     * 🚨 新增：获取我的下载
     * @param {object} params - {userId, page, pageSize}
     */
    getMyDownloads: (params) => callCloud('book-service', {
      action: 'getMyDownloads',
      ...params
    }),
    
    /**
     * 🚨 新增：获取我的已完成
     * @param {object} params - {userId, page, pageSize}
     */
    getMyCompleted: (params) => callCloud('book-service', {
      action: 'getMyCompleted',
      ...params
    }),
    
    /**
     * 🚨 新增：获取我的进行中
     * @param {object} params - {userId, page, pageSize}
     */
    getMyInProgress: (params) => callCloud('book-service', {
      action: 'getMyInProgress',
      ...params
    }),
    
    /**
     * 🚨 新增：获取我的所有书籍统计
     * @param {object} params - {userId}
     */
    getMyAllBookStats: (params) => callCloud('book-service', {
      action: 'getMyAllBookStats',
      ...params
    }),
    
    /**
     * 获取书籍列表
     * @param {object} params - {page, limit, category, sort}
     */
    getList: (params = {}) => callCloud('book-service', {
      action: 'getBookList',
      page: params.page || 1,
      limit: params.limit || 20,
      category: params.category,
      sort: params.sort || 'hot'
    }),
    
    /**
     * 获取书籍详情
     * @param {string|number} bookId - 书籍ID
     */
    getDetail: (bookId) => callCloud('book-service', {
      action: 'getBookDetail',
      id: bookId
    }),
    
    /**
     * 搜索书籍
     * @param {string} keyword - 关键词
     * @param {object} options - 搜索选项
     */
    search: (keyword, options = {}) => callCloud('book-service', {
      action: 'searchBooks',
      keyword: keyword,
      page: options.page || 1,
      limit: options.limit || 20
    }),
    
    /**
     * 按分类获取书籍
     * @param {string} category - 分类ID
     */
    getByCategory: (category, params = {}) => callCloud('book-service', {
      action: 'getBooksByCategory',
      category: category,
      page: params.page || 1,
      limit: params.limit || 20
    }),
    
    /**
     * 获取热门书籍
     */
    getHot: (limit = 10) => callCloud('book-service', {
      action: 'getHotBooks',
      limit: limit
    }),
    
    /**
     * 获取推荐书籍
     */
    getRecommend: (limit = 10) => callCloud('book-service', {
      action: 'getRecommendBooks',
      limit: limit
    }),

    /**
     * 获取新书推荐
     */
    getNew: (limit = 10) => callCloud('book-service', {
      action: 'getNewBooks',
      limit: limit
    }),

    /**
     * 获取分类列表 - 新增方法
     */
    getCategories: (params = {}) => callCloud('book-service', {
      action: 'getCategories',
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      withBookCount: params.withBookCount !== false,
      sortBy: params.sortBy || 'sort',
      order: params.order || 'asc',
      onlyHot: params.onlyHot || false,
      onlyRecommend: params.onlyRecommend || false
    }),

    /**
     * 搜索分类 - 新增方法
     */
    searchCategories: (keyword, params = {}) => callCloud('book-service', {
      action: 'searchCategories',
      keyword: keyword,
      page: params.page || 1,
      pageSize: params.pageSize || 20
    }),

    /**
     * 获取分类详情 - 新增方法
     */
    getCategoryDetail: (categoryId) => callCloud('book-service', {
      action: 'getCategoryDetail',
      categoryId: categoryId
    }),

    /**
     * 获取热门分类 - 新增方法
     */
    getPopularCategories: (limit = 8) => callCloud('book-service', {
      action: 'getPopularCategories',
      limit: limit
    }),

    /**
     * 🚨 新增：测试连接方法
     */
    testConnection: () => callCloud('book-service', {
      action: 'test',
      message: '测试连接'
    })
  },
  
 // ============ 章节服务 ============
chapter: {
    /**
     * 获取书籍章节列表 - 🚨 修正：使用正确的 action
     * @param {string|number} bookId - 书籍ID
     * @param {object} params - 分页参数 {page, pageSize}
     */
    getList: (bookId, params = {}) => callCloud('chapter-service', {
      action: 'getChapterList',  // 🚨 正确的 action！
      bookId: bookId,
      page: params.page || 1,
      pageSize: params.pageSize || 20
    }),
    
    /**
     * 获取章节详情 - 🚨 修正：使用正确的 action
     * @param {string|number} chapterId - 章节ID
     */
    getDetail: (chapterId) => callCloud('chapter-service', {
      action: 'getChapterDetail',  // 🚨 正确的 action！
      chapterId: chapterId  // 🚨 注意参数名也要匹配云函数
    }),
    
    /**
     * 获取下一章节 - 🚨 新增方法
     * @param {string|number} chapterId - 当前章节ID
     */
    getNext: (chapterId) => callCloud('chapter-service', {
      action: 'getNextChapter',
      chapterId: chapterId
    }),
    
    /**
     * 获取章节字幕 - 🚨 新增方法
     * @param {string|number} chapterId - 章节ID
     */
    getSubtitle: (chapterId) => callCloud('chapter-service', {
      action: 'getSubtitle',
      chapterId: chapterId
    }),
    
    /**
     * 点赞章节 - 🚨 新增方法
     * @param {string|number} chapterId - 章节ID
     */
    like: (chapterId) => callCloud('chapter-service', {
      action: 'likeChapter',
      chapterId: chapterId
    }),
    
    /**
     * 更新收听进度 - 🚨 新增方法
     * @param {object} data - {chapterId, progress, duration, completed}
     */
    updateProgress: (data) => callCloud('chapter-service', {
      action: 'updateListenProgress',
      chapterId: data.chapterId,
      progress: data.progress || 0,
      duration: data.duration || 0,
      completed: data.completed || false
    }),
    
    /**
     * 下载章节 - 🚨 新增方法
     * @param {string|number} chapterId - 章节ID
     */
    download: (chapterId) => callCloud('chapter-service', {
      action: 'downloadChapter',
      chapterId: chapterId
    }),
    
    /**
     * 获取音频URL - 🚨 调整：使用章节详情中的URL
     * @param {string|number} chapterId - 章节ID
     * @param {string} quality - 音质（可选）
     */
    getAudioUrl: (chapterId, quality = 'standard') => {
      // 首先获取章节详情，其中包含audioUrl
      return callCloud('chapter-service', {
        action: 'getChapterDetail',
        chapterId: chapterId
      }).then(chapterDetail => {
        // 从章节详情中提取音频URL
        const audioUrl = chapterDetail.audioUrl;
        if (!audioUrl) {
          throw new Error('章节没有音频文件');
        }
        
        // 可以根据quality参数处理不同的音质
        // 这里假设audioUrl已经包含了正确的音质
        return {
          url: audioUrl,
          quality: quality,
          duration: chapterDetail.duration,
          fileSize: chapterDetail.fileSize
        };
      });
    },
    
    // ============ 管理员功能（可选）============
    
    /**
     * 添加章节（管理员） - 🚨 新增方法
     * @param {object} data - 章节数据
     */
    add: (data) => callCloud('chapter-service', {
      action: 'addChapter',
      ...data
    }),
    
    /**
     * 更新章节（管理员） - 🚨 新增方法
     * @param {object} data - {chapterId, ...updateData}
     */
    update: (data) => callCloud('chapter-service', {
      action: 'updateChapter',
      ...data
    }),
    
    /**
     * 删除章节（管理员） - 🚨 新增方法
     * @param {string|number} chapterId - 章节ID
     */
    remove: (chapterId) => callCloud('chapter-service', {
      action: 'deleteChapter',
      chapterId: chapterId
    }),
    
    /**
     * 🚨 测试连接方法
     */
    testConnection: () => callCloud('chapter-service', {
      action: 'getChapterList',
      bookId: '101',
      page: 1,
      pageSize: 5
    })
  },
  
  // ============ 书架服务 ============
  shelf: {
    /**
     * 获取用户书架列表
     */
    getList: () => callCloud('shelf-service', {
      action: 'getList'
    }),
    
    /**
     * 添加到书架
     * @param {string|number} bookId - 书籍ID
     */
    add: (bookId) => callCloud('shelf-service', {
      action: 'add',
      bookId: bookId
    }),
    
    /**
     * 从书架移除
     * @param {string|number} bookId - 书籍ID
     */
    remove: (bookId) => callCloud('shelf-service', {
      action: 'remove',
      bookId: bookId
    }),
    
    /**
     * 检查是否在书架
     * @param {string|number} bookId - 书籍ID
     */
    check: (bookId) => callCloud('shelf-service', {
      action: 'check',
      bookId: bookId
    }),
    
    /**
     * 批量操作
     * @param {array} bookIds - 书籍ID数组
     * @param {string} action - 操作类型（add/remove）
     */
    batch: (bookIds, action) => callCloud('shelf-service', {
      action: 'batch',
      bookIds: bookIds,
      operation: action
    })
  },
  
  // ============ 🎵 播放服务（双模式播放器完整API） ============
  player: {
    /**
     * 🎵 保存播放进度
     * @param {object} data - {chapterId, progress, duration, completed}
     */
    // savePlayProgress: (data) => callCloud('player-service', {
    //   action: 'savePlayProgress',
    //   chapterId: data.chapterId,
    //   progress: data.progress || 0,
    //   duration: data.duration || 0,
    //   completed: data.completed || false,
    //   playTime: data.playTime || Date.now()
    // }),
    
    /**
     * 🎵 获取播放历史
     * @param {object} params - {page, pageSize}
     */
    getPlayHistory: (params = {}) => callCloud('player-service', {
      action: 'getPlayHistory',
      page: params.page || 1,
      pageSize: params.pageSize || 20
    }),
    
    /**
     * 🎵 获取继续播放（从云端恢复）
     */
    getContinuePlay: () => callCloud('player-service', {
      action: 'getContinuePlay'
    }),
    
    /**
     * 🎵 获取最近播放
     * @param {object} params - {limit}
     */
    getRecentlyPlayed: (params = {}) => callCloud('player-service', {
      action: 'getRecentlyPlayed',
      limit: params.limit || 10
    }),
    
    /**
     * 🎵 获取播放统计
     */
    getPlayStatistics: () => callCloud('player-service', {
      action: 'getPlayStatistics'
    }),
    
    /**
     * 🎵 同步播放数据（批量同步本地数据到云端）
     * @param {object} data - 本地播放数据
     */
    syncPlaybackData: (data) => callCloud('player-service', {
      action: 'syncPlaybackData',
      currentPlay: data.currentPlay,
      playHistory: data.playHistory,
      favorites: data.favorites,
      studyStats: data.studyStats,
      syncTime: Date.now()
    }),
    
    /**
     * 🎵 获取学习统计（云端）
     */
    getStudyStats: () => callCloud('player-service', {
      action: 'getStudyStats'
    }),
    
    /**
     * 🎵 同步待处理数据（用于双模式同步）
     * @param {array} pendingData - 待同步数据队列
     */
    syncPendingData: (pendingData) => callCloud('player-service', {
      action: 'syncPendingData',
      pendingData: pendingData,
      syncTime: Date.now()
    }),
    
    /**
     * 🎵 标记同步完成
     * @param {array} syncIds - 同步ID数组
     */
    markSyncComplete: (syncIds) => callCloud('player-service', {
      action: 'markSyncComplete',
      syncIds: syncIds
    }),
    
    /**
     * 🎵 获取用户播放设置
     */
    getUserSettings: () => callCloud('player-service', {
      action: 'getUserSettings'
    }),
    
    /**
     * 🎵 更新用户播放设置
     * @param {object} settings - 播放设置
     */
    updateUserSettings: (settings) => callCloud('player-service', {
      action: 'updateUserSettings',
      ...settings
    }),
    
    /**
     * 🎵 测试播放服务连接
     */
    testConnection: () => callCloud('player-service', {
      action: 'test',
      message: '播放服务测试'
    }),
    
    // === 原有方法的别名（保持兼容）===
    
    /**
     * 保存播放进度（兼容旧版）
     * @param {object} data - {bookId, chapterId, progress, duration}
     */
    saveProgress: (data) => callCloud('player-service', {
      action: 'saveProgress',
      ...data
    }),
    
    /**
     * 获取播放进度（兼容旧版）
     * @param {string|number} bookId - 书籍ID
     */
    getProgress: (bookId) => callCloud('player-service', {
      action: 'getProgress',
      bookId: bookId
    }),
    
    /**
     * 获取播放历史（兼容旧版）
     * @param {object} params - {page, limit}
     */
    getHistory: (params = {}) => callCloud('player-service', {
      action: 'getHistory',
      page: params.page || 1,
      limit: params.limit || 20
    }),
    
    /**
     * 清除播放记录（兼容旧版）
     */
    clearHistory: () => callCloud('player-service', {
      action: 'clearHistory'
    }),
    
    /**
     * 记录播放完成（兼容旧版）
     * @param {object} data - {bookId, chapterId}
     */
    recordComplete: (data) => callCloud('player-service', {
      action: 'recordComplete',
      ...data
    })
  },
  
  // ============ 游戏化服务 ============
  game: {
    /**
     * 获取用户成就
     */
    getAchievements: () => callCloud('game-service', {
      action: 'getAchievements'
    }),
    
    /**
     * 获取学习数据统计
     */
    getStatistics: () => callCloud('game-service', {
      action: 'getStatistics'
    }),
    
    /**
     * 完成学习任务
     * @param {string} taskId - 任务ID
     */
    completeTask: (taskId) => callCloud('game-service', {
      action: 'completeTask',
      taskId: taskId
    }),
    
    /**
     * 获取排行榜
     * @param {string} type - 排行类型（daily, weekly, monthly）
     */
    getRanking: (type = 'daily') => callCloud('game-service', {
      action: 'getRanking',
      type: type
    })
  },
  
  // ============ 社交服务 ============
  social: {
    /**
     * 分享书籍
     * @param {string|number} bookId - 书籍ID
     */
    share: (bookId) => callCloud('social-service', {
      action: 'share',
      bookId: bookId
    }),
    
    /**
     * 点赞/取消点赞
     * @param {string|number} bookId - 书籍ID
     * @param {boolean} like - 是否点赞
     */
    like: (bookId, like = true) => callCloud('social-service', {
      action: 'like',
      bookId: bookId,
      like: like
    }),
    
    /**
     * 评论
     * @param {object} data - {bookId, content, parentId}
     */
    comment: (data) => callCloud('social-service', {
      action: 'comment',
      ...data
    }),
    
    /**
     * 获取评论列表
     * @param {string|number} bookId - 书籍ID
     */
    getComments: (bookId, params = {}) => callCloud('social-service', {
      action: 'getComments',
      bookId: bookId,
      page: params.page || 1,
      limit: params.limit || 20
    })
  },
  
  // ============ 🆕 学习数据服务（纯爬取版） ============
  study: {
    /**
     * 获取个人中心完整数据
     * @param {string|object} params - 用户ID或参数对象
     * @returns {Promise<Object>} - 包含userInfo, studyData, bookStats的完整数据
     */
    getUserProfileData: (params) => {
      const data = typeof params === 'string' ? { userId: params } : params;
      return callCloud('study-service', {
        action: 'getUserProfileData',
        ...data
      });
    },
    
    /**
     * 获取学习统计数据（从现有表爬取）
     * @param {string|object} params - 用户ID或参数对象
     * @returns {Promise<Object>} - 学习统计信息
     */
    getStudyStats: (params) => {
      const data = typeof params === 'string' ? { userId: params } : params;
      return callCloud('study-service', {
        action: 'getStudyStats',
        ...data
      });
    },
    
    /**
     * 获取书籍统计（从各个表爬取）
     * @param {string|object} params - 用户ID或参数对象
     * @returns {Promise<Object>} - 书籍统计信息
     */
    getBookStats: (params) => {
      const data = typeof params === 'string' ? { userId: params } : params;
      return callCloud('study-service', {
        action: 'getBookStats',
        ...data
      });
    },
    
    /**
     * 获取学习历史
     * @param {string|object} params - 用户ID或参数对象
     * @returns {Promise<Object>} - 学习历史列表
     */
    getLearningHistory: (params) => {
      // 支持两种调用方式：getLearningHistory(userId, params) 或 getLearningHistory({userId, page, pageSize})
      let data = {};
      if (typeof params === 'string') {
        // 第一个参数是userId，第二个参数是配置
        const userId = params;
        const config = arguments[1] || {};
        data = { userId, ...config };
      } else {
        data = params || {};
      }
      return callCloud('study-service', {
        action: 'getLearningHistory',
        ...data
      });
    },
    
    /**
     * 获取最近活动（综合各个表）
     * @param {string|object} params - 用户ID或参数对象
     * @returns {Promise<Array>} - 最近活动列表
     */
    getRecentActivity: (params) => {
      let data = {};
      if (typeof params === 'string') {
        // 第一个参数是userId，第二个参数是配置
        const userId = params;
        const config = arguments[1] || {};
        data = { userId, ...config };
      } else {
        data = params || {};
      }
      return callCloud('study-service', {
        action: 'getRecentActivity',
        ...data
      });
    },
    
    /**
     * 测试连接
     * @returns {Promise<Object>} - 测试结果
     */
    test: () => callCloud('study-service', {
      action: 'test'
    })
  }
}

/**
 * 测试云函数连接
 */
const testConnection = () => {
  return callCloud('book-service', {
    action: 'test',
    message: '测试连接'
  })
}

/**
 * 工具函数：创建请求配置
 */
const createRequest = (functionName, defaultData = {}) => {
  return (data = {}) => callCloud(functionName, { ...defaultData, ...data })
}

/**
 * 错误处理装饰器
 */
const withErrorHandler = (fn) => {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error('云函数调用错误:', error)
      
      if (error.isLoginError) {
        console.log('🔍 检测到登录验证失败，但不立即清除登录状态')
        wx.showToast({
          title: '请重新登录',
          icon: 'none',
          duration: 3000
        })
        throw error
      }
      
      if (isLoginExpiredError(error)) {
        console.log('检测到登录过期')
        clearLoginState()
        wx.showToast({
          title: '登录已过期，请重新登录',
          icon: 'none',
          duration: 3000
        })
        throw error
      }
      
      if (error.code === 'NETWORK_ERROR') {
        wx.showToast({
          title: '网络连接失败，请检查网络设置',
          icon: 'none',
          duration: 3000
        })
      } else if (error.code === 404 || error.status === 404) {
        wx.showToast({
          title: '服务暂时不可用，请稍后重试',
          icon: 'none',
          duration: 3000
        })
      } else if (error.message) {
        wx.showToast({
          title: error.message,
          icon: 'none',
          duration: 3000
        })
      } else {
        wx.showToast({
          title: '请求失败，请重试',
          icon: 'none',
          duration: 3000
        })
      }
      
      throw error
    }
  }
}

/**
 * 检查登录状态是否有效
 */
const checkLoginValid = async () => {
  try {
    const token = wx.getStorageSync('token')
    if (!token) {
      return false
    }
    
    const result = await callCloud('user-service', {
      action: 'getUserInfo'
    }).catch(error => {
      console.log('检查登录状态失败:', error)
      return false
    })
    
    return !!result
  } catch (error) {
    console.error('检查登录状态失败:', error)
    return false
  }
}

// ==================== 导出部分 ====================
module.exports = {
  initCloud,
  callCloud,
  debugCallCloud,
  testConnection,
  createRequest,
  withErrorHandler,
  clearLoginState,
  checkLoginValid,
  isLoginExpiredError,
  handleResponse,
  cloudAPI,
  user: cloudAPI.user,
  book: cloudAPI.book,
  chapter: cloudAPI.chapter,
  shelf: cloudAPI.shelf,
  player: cloudAPI.player,
  game: cloudAPI.game,
  social: cloudAPI.social,
  study: cloudAPI.study
}