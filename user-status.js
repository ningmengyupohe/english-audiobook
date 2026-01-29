// utils/user-status.js
const app = getApp();

/**
 * 🚨 用户状态管理器
 * 管理登录状态，让所有页面都能访问用户ID
 */
class UserStatusManager {
  constructor() {
    this.userInfo = null;
    this.token = null;
    this.currentUserId = 0;
    this.init();
  }

  /**
   * 初始化 - 从本地存储加载用户状态
   */
  init() {
    console.log('🔄 初始化用户状态管理器');
    
    try {
      // 🚨 修复：先同步app全局数据
      if (app && app.syncLoginState) {
        const syncResult = app.syncLoginState();
        console.log('🔍 同步结果:', syncResult);
      }
      
      // 🚨 修复：从app全局数据获取（优先级最高）
      if (app && app.globalData) {
        this.token = app.globalData.token || null;
        this.userInfo = app.globalData.userInfo || null;
        console.log('🔍 从globalData获取:', {
          有token: !!this.token,
          有userInfo: !!this.userInfo
        });
      }
      
      // 🚨 修复：如果全局数据为空，再从本地存储获取
      if (!this.token) {
        this.token = wx.getStorageSync('token') || null;
        if (this.token) {
          console.log('🔍 从storage获取token');
        }
      }
      
      if (!this.userInfo) {
        this.userInfo = wx.getStorageSync('userInfo') || null;
        if (this.userInfo) {
          console.log('🔍 从storage获取userInfo');
        }
      }
      
      // 🚨 修复：提取用户ID
      this.currentUserId = this.extractUserId(this.userInfo);
      
      console.log('✅ 用户状态管理器初始化完成', {
        userId: this.currentUserId,
        hasToken: !!this.token,
        hasUserInfo: !!this.userInfo,
        token长度: this.token ? this.token.length : 0,
        token前20位: this.token ? this.token.substring(0, 20) + '...' : '空'
      });
      
      // 🚨 修复：确保token同步到全局
      if (this.token && app && app.globalData) {
        app.globalData.token = this.token;
      }
      
      return {
        success: true,
        userId: this.currentUserId,
        hasUserInfo: !!this.userInfo,
        hasToken: !!this.token
      };
    } catch (error) {
      console.error('❌ 用户状态管理器初始化失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🚨 从用户信息中提取用户ID
   */
  extractUserId(userInfo) {
    if (!userInfo) return 0;
    
    let userId = 0;
    
    // 尝试从不同字段获取用户ID
    if (userInfo.userIdNumber) {
      userId = Number(userInfo.userIdNumber);
    } else if (userInfo._id) {
      userId = Number(userInfo._id);
    } else if (userInfo.id) {
      userId = Number(userInfo.id);
    } else if (userInfo.userId) {
      userId = Number(userInfo.userId);
    }
    
    // 验证用户ID
    if (isNaN(userId) || userId <= 0) {
      console.warn('⚠️ 用户ID无效:', userId);
      return 0;
    }
    
    return userId;
  }

  /**
   * 🚨 登录成功 - 保存用户信息到全局
   */
  loginSuccess(userData) {
    console.log('🚨 用户登录成功，保存用户信息:', userData);
    
    try {
      // 🚨 关键：从用户数据中提取数字类型的用户ID
      const userId = this.extractUserId(userData);
      
      if (userId <= 0) {
        console.error('❌ 用户ID无效，无法登录');
        return {
          success: false,
          message: '用户ID无效'
        };
      }
      
      // 🚨 构建标准的用户信息对象
      const userInfo = {
        // ID相关字段
        _id: userData._id || '',
        id: userData.id || '',
        userId: userId ? userId.toString() : '',
        userIdNumber: userId,
        
        // 基本信息
        username: userData.username || '',
        nickname: userData.nickname || '',
        phone: userData.phone || '',
        email: userData.email || '',
        avatar: userData.avatar || '/images/avatar/default.png',
        
        // 学习信息
        level: userData.level || '初级',
        isVip: userData.isVip || false,
        learningDays: userData.learningDays || 0,
        
        // 统计信息
        reportCount: userData.reportCount || 0,
        likeCount: userData.likeCount || 0,
        
        // 状态信息
        status: userData.status || '正常',
        
        // 认证信息
        token: userData.token || '',
        lastLoginTime: userData.lastLoginTime || Date.now(),
        createTime: userData.createTime || Date.now(),
        updateTime: userData.updateTime || Date.now()
      };
      
      // 🚨 获取token（优先使用userData.token）
      const token = userData.token || '';
      
      console.log('🔧 登录数据:', {
        userId: userId,
        token长度: token.length,
        token前20位: token.substring(0, 20) + '...',
        nickname: userInfo.nickname
      });
      
      // 🚨 使用app的updateLoginState函数确保一致性
      if (app && app.updateLoginState) {
        app.updateLoginState(token, userInfo);
      } else {
        // 降级处理
        wx.setStorageSync('token', token);
        wx.setStorageSync('userInfo', userInfo);
        
        if (app && app.globalData) {
          app.globalData.token = token;
          app.globalData.userInfo = userInfo;
        }
      }
      
      // 🚨 更新实例状态
      this.token = token;
      this.userInfo = userInfo;
      this.currentUserId = userId;
      
      // 🚨 新增：初始化学习数据到本地存储（如果没有的话）
      if (!wx.getStorageSync('studyData')) {
        const defaultStudyData = {
          totalMinutes: 0,
          booksCount: 0,
          daysCount: 0,
          wordsCount: 0,
          dailyGoal: 30,
          goalProgress: 0
        };
        wx.setStorageSync('studyData', defaultStudyData);
      }
      
      if (!wx.getStorageSync('bookStats')) {
        const defaultBookStats = {
          completed: 0,
          downloaded: 0,
          favorites: 0,
          inProgress: 0,
          total: 0
        };
        wx.setStorageSync('bookStats', defaultBookStats);
      }
      
      // 🚨 通知所有页面更新
      this.notifyAllPages('login');
      
      console.log('✅ 用户登录状态保存成功:', {
        userId: userId,
        nickname: userInfo.nickname,
        hasToken: !!this.token
      });
      
      return {
        success: true,
        userId: userId,
        userInfo: userInfo,
        message: '登录成功'
      };
    } catch (error) {
      console.error('❌ 保存用户信息失败:', error);
      return {
        success: false,
        error: error.message,
        message: '登录状态保存失败'
      };
    }
  }

  /**
   * 🚨 获取当前用户ID（所有页面都可调用）
   */
  getCurrentUserId() {
    // 🚨 修复：先从实例状态获取
    if (this.currentUserId && this.currentUserId > 0) {
      return this.currentUserId;
    }
    
    // 🚨 修复：从userInfo中提取
    const userInfo = this.getUserInfo();
    if (userInfo) {
      const userId = this.extractUserId(userInfo);
      if (userId > 0) {
        this.currentUserId = userId;
        return userId;
      }
    }
    
    return 0;
  }

  /**
   * 🚨 获取用户信息（所有页面都可调用）
   */
  getUserInfo() {
    // 🚨 修复：优先级调整
    if (this.userInfo) {
      return this.userInfo;
    }
    
    // 从全局数据获取
    if (app && app.globalData && app.globalData.userInfo) {
      this.userInfo = app.globalData.userInfo;
      return this.userInfo;
    }
    
    // 从本地存储获取
    try {
      const storedInfo = wx.getStorageSync('userInfo');
      if (storedInfo) {
        this.userInfo = storedInfo;
        // 更新到全局变量
        if (app && app.globalData) {
          app.globalData.userInfo = storedInfo;
        }
        return storedInfo;
      }
    } catch (error) {
      console.error('读取用户信息失败:', error);
    }
    
    return null;
  }

  /**
   * 🚨 检查是否登录 - 改进版
   */
  isLoggedIn() {
    const token = this.getToken();
    const userId = this.getCurrentUserId();
    
    const isLogin = !!(token && token.length > 10 && userId > 0);
    
    console.log('🔍 检查登录状态:', {
      isLogin: isLogin,
      hasToken: !!token,
      token长度: token ? token.length : 0,
      userId: userId
    });
    
    return isLogin;
  }

  /**
   * 🚨 获取token - 改进版
   */
  getToken() {
    // 🚨 修复：从实例状态获取
    if (this.token && this.token.length > 10) {
      return this.token;
    }
    
    // 从全局数据获取
    if (app && app.globalData && app.globalData.token) {
      this.token = app.globalData.token;
      return this.token;
    }
    
    // 从本地存储获取
    try {
      const storedToken = wx.getStorageSync('token');
      if (storedToken && storedToken.length > 10) {
        this.token = storedToken;
        // 更新到全局变量
        if (app && app.globalData) {
          app.globalData.token = storedToken;
        }
        return storedToken;
      }
    } catch (error) {
      console.error('读取token失败:', error);
    }
    
    return null;
  }

  /**
   * 🚨 退出登录
   */
  logout() {
    console.log('🚨 用户退出登录');
    
    try {
      // 使用app的清除函数确保一致性
      if (app && app.clearLoginState) {
        app.clearLoginState();
      } else {
        // 清除本地存储
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        
        // 清除全局变量
        if (app && app.globalData) {
          app.globalData.token = null;
          app.globalData.userInfo = null;
        }
      }
      
      // 清除实例状态
      this.token = null;
      this.userInfo = null;
      this.currentUserId = 0;
      
      // 🚨 通知所有页面更新
      this.notifyAllPages('logout');
      
      console.log('✅ 用户退出登录完成');
      
      return {
        success: true,
        message: '退出登录成功'
      };
    } catch (error) {
      console.error('❌ 退出登录失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🚨 刷新用户状态（从本地存储重新加载）
   */
  refresh() {
    console.log('🔄 刷新用户状态');
    return this.init();
  }

  /**
   * 🚨 通知所有页面更新（通过全局标记）
   */
  notifyAllPages(event) {
    console.log(`📢 通知所有页面: ${event}`, {
      event: event,
      time: new Date().toLocaleTimeString()
    });
    
    // 设置全局标记，让各个页面在onShow时检查
    if (app && app.globalData) {
      app.globalData.userStatusChanged = true;
      app.globalData.lastUserEvent = event;
      app.globalData.lastUserEventTime = Date.now();
      
      // 如果是登录事件，设置页面刷新标记
      if (event === 'login') {
        app.globalData.shouldRefreshHome = true;
        app.globalData.shouldRefreshProfile = true;
        console.log('🚨 设置页面刷新标记');
      }
    }
  }

  /**
   * 🚨 更新用户信息（如修改头像、昵称后）
   */
  updateUserInfo(newInfo) {
    console.log('🔄 更新用户信息:', newInfo);
    
    try {
      const currentInfo = this.getUserInfo() || {};
      const updatedInfo = { ...currentInfo, ...newInfo };
      
      // 更新用户ID相关字段
      if (newInfo._id && !updatedInfo.userIdNumber) {
        updatedInfo.userIdNumber = Number(newInfo._id);
      }
      
      // 🚨 使用app的updateLoginState函数
      if (app && app.updateLoginState) {
        const token = this.getToken();
        app.updateLoginState(token, updatedInfo);
      } else {
        // 保存到本地存储
        wx.setStorageSync('userInfo', updatedInfo);
        
        // 更新到全局变量
        if (app && app.globalData) {
          app.globalData.userInfo = updatedInfo;
        }
      }
      
      // 更新实例状态
      this.userInfo = updatedInfo;
      
      console.log('✅ 用户信息已更新:', {
        userId: updatedInfo.userIdNumber,
        nickname: updatedInfo.nickname
      });
      
      // 通知页面更新
      this.notifyAllPages('update');
      
      return {
        success: true,
        userInfo: updatedInfo,
        message: '用户信息更新成功'
      };
    } catch (error) {
      console.error('❌ 更新用户信息失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🚨 强制同步到全局（用于页面间数据不一致的情况）
   */
  forceSyncToGlobal() {
    console.log('🔄 强制同步到全局');
    
    // 从本地存储重新加载
    this.refresh();
    
    // 🚨 确保全局数据是最新的
    if (app && app.globalData) {
      app.globalData.token = this.token;
      app.globalData.userInfo = this.userInfo;
    }
    
    console.log('✅ 全局数据已同步:', {
      userId: this.currentUserId,
      hasUserInfo: !!this.userInfo,
      hasToken: !!this.token
    });
    
    return {
      token: this.token,
      userInfo: this.userInfo,
      currentUserId: this.currentUserId
    };
  }

  /**
   * 🚨 获取格式化后的用户信息（用于页面显示）
   */
  getFormattedUserInfo() {
    const userInfo = this.getUserInfo();
    const userId = this.getCurrentUserId();
    
    if (!userInfo || userId <= 0) {
      return {
        avatar: '/images/avatar/default.png',
        nickname: '英语学习者',
        username: '',
        userId: '',
        userIdNumber: 0,
        isVip: false,
        level: 1,
        learningDays: 0
      };
    }
    
    return {
      avatar: userInfo.avatar || '/images/avatar/default.png',
      nickname: userInfo.nickname || userInfo.username || '英语学习者',
      username: userInfo.username || '',
      userId: userId ? userId.toString() : '',
      userIdNumber: userId,
      isVip: userInfo.isVip || false,
      level: userInfo.level || '初级',
      learningDays: userInfo.learningDays || 0
    };
  }

  /**
   * 🚨 获取学习数据（从本地存储）
   */
  getStudyData() {
    try {
      return wx.getStorageSync('studyData') || {
        totalMinutes: 0,
        booksCount: 0,
        daysCount: 0,
        wordsCount: 0,
        dailyGoal: 30,
        goalProgress: 0
      };
    } catch (error) {
      console.error('获取学习数据失败:', error);
      return {
        totalMinutes: 0,
        booksCount: 0,
        daysCount: 0,
        wordsCount: 0,
        dailyGoal: 30,
        goalProgress: 0
      };
    }
  };

  /**
   * 🚨 获取书籍统计（从本地存储）
   */
  getBookStats() {
    try {
      return wx.getStorageSync('bookStats') || {
        completed: 0,
        downloaded: 0,
        favorites: 0,
        inProgress: 0,
        total: 0
      };
    } catch (error) {
      console.error('获取书籍统计失败:', error);
      return {
        completed: 0,
        downloaded: 0,
        favorites: 0,
        inProgress: 0,
        total: 0
      };
    }
  };

  /**
   * 🚨 调试：显示当前用户状态
   */
  debug() {
    console.log('🔍 === 用户状态调试信息 ===');
    
    const state = {
      // 实例状态
      instance: {
        currentUserId: this.currentUserId,
        hasUserInfo: !!this.userInfo,
        hasToken: !!this.token,
        token长度: this.token ? this.token.length : 0,
        token前20位: this.token ? this.token.substring(0, 20) + '...' : '空'
      },
      // 全局状态
      global: {
        currentUserId: app && app.globalData ? app.globalData.currentUserId : 'app未初始化',
        hasUserInfo: app && app.globalData ? !!app.globalData.userInfo : false,
        hasToken: app && app.globalData ? !!app.globalData.token : false,
        token长度: app && app.globalData && app.globalData.token ? app.globalData.token.length : 0,
        token前20位: app && app.globalData && app.globalData.token ? 
          app.globalData.token.substring(0, 20) + '...' : '空'
      },
      // 本地存储
      storage: {
        token: wx.getStorageSync('token') ? wx.getStorageSync('token').substring(0, 20) + '...' : '空',
        token长度: wx.getStorageSync('token') ? wx.getStorageSync('token').length : 0,
        hasUserInfo: !!wx.getStorageSync('userInfo'),
        hasStudyData: !!wx.getStorageSync('studyData'),
        hasBookStats: !!wx.getStorageSync('bookStats')
      },
      // 🚨 新增：登录状态判断
      loginStatus: {
        isLoggedIn: this.isLoggedIn(),
        getToken: this.getToken() ? '有token' : '无token',
        getUserId: this.getCurrentUserId(),
        getUserInfo: this.getUserInfo() ? '有userInfo' : '无userInfo'
      }
    };
    
    console.log('用户状态详情:', JSON.stringify(state, null, 2));
    
    return state;
  }
}

// 🚨 创建全局单例
let userStatusManager = null;

// 确保只创建一个实例
if (!global.userStatusManager) {
  userStatusManager = new UserStatusManager();
  global.userStatusManager = userStatusManager;
} else {
  userStatusManager = global.userStatusManager;
}

module.exports = userStatusManager;