// pages/profile/profile.js
const userStatusManager = require('../../utils/user-status.js');
const app = getApp();

Page({
  data: {
    userInfo: {
      avatar: '/images/avatar/default.png',
      nickname: '未登录',
      username: '',
      userId: '',
      userIdNumber: 0,
      isVip: false,
      level: '',
      learningDays: 0
    },
    studyData: {
      totalMinutes: 0,
      booksCount: 0,
      daysCount: 0,
      wordsCount: 0,
      dailyGoal: 30,
      goalProgress: 0
    },
    bookStats: {
      completed: 0,
      downloaded: 0,
      favorites: 0,
      inProgress: 0,
      total: 0
    },
    version: '1.0.0',
    isLoading: false,
    isRefreshing: false,
    hasUserInfo: false,
    loginExpired: false,
    showExpiredModal: false,
    useLocalData: false,
    lastLoginCheck: 0,
    loginSuccessTriggered: false,
    debugMode: false
  },

  onLoad: function() {
    console.log('个人中心页面加载');
    this.initPage();
  },

  onShow: function() {
    console.log('个人中心页面显示');
    
    // 🚨 检查用户状态
    this.checkUserStatus();
    
    // 检查全局标记
    if (app.globalData.shouldRefreshProfile) {
      console.log('🚨 检测到需要刷新个人中心数据');
      this.forceRefreshFromLogin();
      app.globalData.shouldRefreshProfile = false;
    }
  },

  onHide: function() {
    console.log('个人中心页面隐藏');
  },

  onUnload: function() {
    console.log('个人中心页面卸载');
  },

  onPullDownRefresh: function() {
    console.log('下拉刷新');
    this.refreshData();
  },

  onShareAppMessage: function() {
    const userInfo = this.data.userInfo;
    const nickname = userInfo.nickname || '英语学习者';
    
    return {
      title: `${nickname} 邀请你一起学习英语`,
      path: '/pages/home/home',
      imageUrl: '/images/share/share-profile.jpg'
    };
  },

  // 🚨 检查用户状态
  checkUserStatus: function() {
    console.log('🔐 Profile页面检查用户状态');
    
    // 🚨 检查是否有用户ID
    const userId = userStatusManager.getCurrentUserId();
    console.log('🔍 当前用户ID:', userId);
    
    if (userId && userId > 0) {
      console.log('✅ 有用户ID，更新页面数据');
      
      // 🚨 1. 立即从本地存储加载所有数据（确保立即显示）
      this.loadFromLocalStorage();
      
      // 🚨 2. 然后异步从服务器获取最新数据
      if (!this.data.isLoading) {
        setTimeout(() => {
          this.loadUserData();
        }, 300);
      }
    } else {
      console.log('❌ 没有用户ID，显示重新登录');
      this.resetToGuestMode();
      
      // 提示用户登录
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 🚨 重置为访客模式
  resetToGuestMode: function() {
    console.log('👤 Profile页面切换到访客模式');
    
    this.setData({
      userInfo: {
        avatar: '/images/avatar/default.png',
        nickname: '未登录',
        username: '',
        userId: '',
        userIdNumber: 0,
        isVip: false,
        level: '',
        learningDays: 0
      },
      hasUserInfo: false,
      loginExpired: false,
      showExpiredModal: false,
      useLocalData: false
    });
    
    // 🚨 重置用户数据
    this.resetUserData();
  },

  /**
   * 🚨 登录成功回调
   */
  onLoginSuccess: function(userData) {
    console.log('🚨 收到登录成功通知，更新个人中心数据', userData);
    
    if (this.data.loginSuccessTriggered) {
      console.log('已处理过登录成功，跳过');
      return;
    }
    
    this.setData({
      loginSuccessTriggered: true
    });
    
    // 🚨 使用用户状态管理器保存用户信息
    const result = userStatusManager.loginSuccess(userData);
    
    if (result.success) {
      console.log('✅ 用户状态已保存，用户ID:', result.userId);
      
      // 更新页面数据
      this.setData({
        userInfo: userStatusManager.getFormattedUserInfo(),
        hasUserInfo: true,
        loginExpired: false,
        showExpiredModal: false,
        isLoading: true,
        useLocalData: false
      });
      
      console.log('✅ 页面数据更新完成');
      
      // 加载用户数据
      setTimeout(() => {
        this.loadUserData();
        setTimeout(() => {
          this.setData({ loginSuccessTriggered: false });
        }, 3000);
      }, 500);
    } else {
      console.error('❌ 保存用户信息失败:', result.error);
    }
  },

  /**
   * 从登录页面强制刷新
   */
  forceRefreshFromLogin: function() {
    console.log('🚨 强制刷新个人中心页面数据');
    
    this.checkUserStatus();
    
    if (this.data.hasUserInfo && !this.data.loginExpired) {
      setTimeout(() => {
        this.loadUserData();
      }, 500);
    }
  },

  /**
   * 初始化页面
   */
  initPage: function() {
    wx.setNavigationBarTitle({
      title: '个人中心'
    });
    
    this.getVersionInfo();
  },

  /**
   * 获取版本信息
   */
  getVersionInfo: function() {
    const accountInfo = wx.getAccountInfoSync();
    if (accountInfo && accountInfo.miniProgram) {
      this.setData({
        version: accountInfo.miniProgram.version || '1.0.0'
      });
    }
  },

  /**
   * 重置用户数据
   */
  resetUserData: function() {
    this.setData({
      studyData: {
        totalMinutes: 0,
        booksCount: 0,
        daysCount: 0,
        wordsCount: 0,
        dailyGoal: 30,
        goalProgress: 0
      },
      bookStats: {
        completed: 0,
        downloaded: 0,
        favorites: 0,
        inProgress: 0,
        total: 0
      }
    });
  },

  /**
   * 🚨 加载用户数据 - 根据ID直接搜索
   */
  loadUserData: async function() {
    console.log('📊 加载用户数据');
    
    // 🚨 获取用户ID
    const userId = userStatusManager.getCurrentUserId();
    console.log('🔍 准备根据ID搜索数据，用户ID:', userId);
    
    if (!userId || userId <= 0) {
      console.log('❌ 没有用户ID，跳过数据加载');
      this.setData({ isLoading: false });
      return;
    }
    
    this.setData({ isLoading: true });
    
    try {
      console.log('🔍 尝试根据用户ID查询学习数据，用户ID:', userId);
      
      // 尝试从云函数获取用户数据
      const { cloudAPI } = require('../../utils/uni-cloud.js');
      
      // 🚨 方案1：使用爬取版获取完整数据
      const profileRes = await cloudAPI.study.getUserProfileData({ userId: userId }).catch(async (error) => {
        console.log('爬取版接口失败，尝试备选方案:', error);
        return await this.getBackupUserData(userId);
      });
      
      console.log('接口响应:', profileRes);
      
      if (profileRes && (profileRes.success === true || profileRes.code === 0)) {
        console.log('✅ 数据查询成功');
        this.handleProfileData(profileRes);
      } else if (profileRes && (profileRes.userInfo || profileRes.studyData || profileRes.bookStats)) {
        // 直接返回的数据对象
        console.log('✅ 获取到直接数据对象');
        this.handleProfileData(profileRes);
      } else {
        console.log('❌ 数据查询失败或无数据，显示0');
        // 显示0，不要虚拟数据
        this.setData({
          studyData: {
            totalMinutes: 0,
            booksCount: 0,
            daysCount: 0,
            wordsCount: 0,
            dailyGoal: 30,
            goalProgress: 0
          },
          bookStats: {
            completed: 0,
            downloaded: 0,
            favorites: 0,
            inProgress: 0,
            total: 0
          },
          isLoading: false,
          useLocalData: false
        });
      }
      
    } catch (error) {
      console.error('加载用户数据失败:', error);
      console.log('❌ 出现异常，显示0');
      // 出现异常也显示0
      this.setData({
        studyData: {
          totalMinutes: 0,
          booksCount: 0,
          daysCount: 0,
          wordsCount: 0,
          dailyGoal: 30,
          goalProgress: 0
        },
        bookStats: {
          completed: 0,
          downloaded: 0,
          favorites: 0,
          inProgress: 0,
          total: 0
        },
        isLoading: false,
        useLocalData: false
      });
    }
  },

  /**
   * 🚨 从本地存储加载所有用户数据
   */
  loadFromLocalStorage: function() {
    console.log('📱 从本地存储加载所有用户数据');
    
    try {
      // 1. 加载用户信息
      const userInfo = userStatusManager.getFormattedUserInfo();
      
      // 2. 加载学习数据
      const studyData = wx.getStorageSync('studyData');
      const defaultStudyData = {
        totalMinutes: 0,
        booksCount: 0,
        daysCount: 0,
        wordsCount: 0,
        dailyGoal: 30,
        goalProgress: 0
      };
      
      // 3. 加载书籍统计
      const bookStats = wx.getStorageSync('bookStats');
      const defaultBookStats = {
        completed: 0,
        downloaded: 0,
        favorites: 0,
        inProgress: 0,
        total: 0
      };
      
      // 4. 更新页面
      this.setData({
        userInfo: userInfo,
        studyData: studyData || defaultStudyData,
        bookStats: bookStats || defaultBookStats,
        hasUserInfo: true,
        loginExpired: false,
        showExpiredModal: false,
        useLocalData: true // 🚨 标记为使用本地数据
      });
      
      console.log('✅ 从本地存储加载数据成功', {
        用户: userInfo.nickname,
        学习分钟: studyData ? studyData.totalMinutes : 0,
        书籍数量: bookStats ? bookStats.total : 0
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ 从本地存储加载数据失败:', error);
      return false;
    }
  },

  /**
   * 🚨 备用方案获取用户数据（当爬取版失败时使用）
   */
  getBackupUserData: async function(userId) {
    console.log('🔄 使用备用方案获取用户数据，用户ID:', userId);
    
    try {
      const { cloudAPI } = require('../../utils/uni-cloud.js');
      
      // 🚨 方案1：尝试从各个表分别获取数据
      const userInfo = userStatusManager.getUserInfo() || {};
      
      // 🚨 方案2：手动统计书籍数据
      const bookStats = await this.calculateBookStatsManually(userId);
      
      // 🚨 方案3：手动统计学习数据
      const studyData = await this.calculateStudyStatsManually(userId);
      
      return {
        success: true,
        code: 0,
        data: {
          userInfo: {
            ...userInfo,
            userId: userInfo._id || userInfo.userId,
            userIdNumber: userInfo._id || userInfo.userIdNumber
          },
          studyData: studyData,
          bookStats: bookStats
        }
      };
      
    } catch (error) {
      console.error('备用方案也失败:', error);
      return null;
    }
  },

  /**
   * 🚨 手动计算书籍统计数据
   */
  calculateBookStatsManually: async function(userId) {
    console.log('📊 手动计算书籍统计数据，用户ID:', userId);
    
    const { cloudAPI } = require('../../utils/uni-cloud.js');
    const numericUserId = parseInt(userId);
    
    try {
      // 这里需要根据实际的数据库结构手动查询
      // 由于没有直接查询各个表的接口，返回默认值
      console.warn('⚠️ 手动计算书籍统计功能需要根据实际数据库表结构实现');
      
      return {
        completed: 0,
        downloaded: 0,
        favorites: 0,
        inProgress: 0,
        total: 0
      };
      
    } catch (error) {
      console.error('手动计算书籍统计失败:', error);
      return {
        completed: 0,
        downloaded: 0,
        favorites: 0,
        inProgress: 0,
        total: 0
      };
    }
  },

  /**
   * 🚨 手动计算学习统计数据
   */
  calculateStudyStatsManually: async function(userId) {
    console.log('📚 手动计算学习统计数据，用户ID:', userId);
    
    try {
      // 从本地学习记录中获取数据
      const localStudyData = wx.getStorageSync('localStudyData_' + userId);
      
      if (localStudyData) {
        console.log('✅ 找到本地学习数据:', localStudyData);
        return {
          totalMinutes: localStudyData.totalMinutes || 0,
          booksCount: localStudyData.booksCount || 0,
          daysCount: localStudyData.daysCount || 0,
          wordsCount: localStudyData.wordsCount || 0,
          dailyGoal: localStudyData.dailyGoal || 30,
          goalProgress: localStudyData.goalProgress || 0
        };
      }
      
      // 默认数据
      return {
        totalMinutes: 0,
        booksCount: 0,
        daysCount: 0,
        wordsCount: 0,
        dailyGoal: 30,
        goalProgress: 0
      };
      
    } catch (error) {
      console.error('手动计算学习统计失败:', error);
      return {
        totalMinutes: 0,
        booksCount: 0,
        daysCount: 0,
        wordsCount: 0,
        dailyGoal: 30,
        goalProgress: 0
      };
    }
  },

  /**
   * 🚨 处理接口返回的数据
   */
  handleProfileData: function(data) {
    console.log('处理接口数据:', data);
    
    // 提取实际数据
    let actualData = data;
    if (data.data !== undefined) {
      actualData = data.data;
    }
    
    const userInfoData = actualData.userInfo || actualData;
    const studyData = actualData.studyData || {};
    const bookStats = actualData.bookStats || {};
    
    // 🚨 获取完整的用户信息
    const currentFullUserInfo = userStatusManager.getUserInfo() || {};
    const currentUserId = userStatusManager.getCurrentUserId();
    
    // 合并用户信息
    const updatedUserInfo = {
      ...currentFullUserInfo,
      ...userInfoData,
      avatar: userInfoData.avatar || currentFullUserInfo.avatar || '/images/avatar/default.png',
      nickname: userInfoData.nickname || userInfoData.username || currentFullUserInfo.nickname || '英语学习者',
      username: userInfoData.username || currentFullUserInfo.username || '',
      isVip: userInfoData.isVip !== undefined ? userInfoData.isVip : currentFullUserInfo.isVip,
      level: userInfoData.level || currentFullUserInfo.level || '初级',
      learningDays: userInfoData.learningDays || currentFullUserInfo.learningDays || 0,
      userId: currentFullUserInfo.userId || userInfoData._id || userInfoData.userId || '',
      userIdNumber: currentFullUserInfo.userIdNumber || currentUserId || userInfoData._id || userInfoData.userIdNumber || 0
    };
    
    // 🚨 格式化学习数据
    const formattedStudyData = {
      totalMinutes: studyData.totalMinutes || 0,
      booksCount: studyData.booksCount || 0,
      daysCount: studyData.daysCount || 0,
      wordsCount: studyData.wordsCount || 0,
      dailyGoal: studyData.dailyGoal || 30,
      goalProgress: studyData.goalProgress || 0
    };
    
    // 🚨 格式化书籍统计
    const formattedBookStats = {
      completed: bookStats.completed || 0,
      downloaded: bookStats.downloaded || 0,
      favorites: bookStats.favorites || 0,
      inProgress: bookStats.inProgress || 0,
      total: bookStats.total || 0
    };
    
    // 🚨 关键：保存到本地存储
    try {
      wx.setStorageSync('studyData', formattedStudyData);
      wx.setStorageSync('bookStats', formattedBookStats);
      console.log('💾 接口数据已保存到本地存储');
    } catch (error) {
      console.error('❌ 保存到本地存储失败:', error);
    }
    
    // 更新页面数据
    this.setData({
      userInfo: updatedUserInfo,
      studyData: formattedStudyData,
      bookStats: formattedBookStats,
      isLoading: false,
      loginExpired: false,
      showExpiredModal: false,
      useLocalData: false // 🚨 标记为已使用接口数据
    });
    
    console.log('✅ 数据更新成功');
    
    // 停止下拉刷新
    if (this.data.isRefreshing) {
      wx.stopPullDownRefresh();
      this.setData({ isRefreshing: false });
    }
  },

  /**
   * 刷新数据
   */
  refreshData: function() {
    console.log('开始刷新数据');
    this.setData({ isRefreshing: true });
    
    // 🚨 检查是否有用户ID
    const userId = userStatusManager.getCurrentUserId();
    if (userId && userId > 0) {
      this.loadUserData().then(() => {
        setTimeout(() => {
          if (this.data.isRefreshing) {
            wx.stopPullDownRefresh();
            this.setData({ isRefreshing: false });
          }
          wx.showToast({
            title: '刷新成功',
            icon: 'success',
            duration: 1500
          });
        }, 500);
      }).catch((error) => {
        console.error('刷新失败:', error);
        setTimeout(() => {
          if (this.data.isRefreshing) {
            wx.stopPullDownRefresh();
            this.setData({ isRefreshing: false });
          }
          wx.showToast({
            title: '刷新完成',
            icon: 'none',
            duration: 1500
          });
        }, 500);
      });
    } else {
      setTimeout(() => {
        wx.stopPullDownRefresh();
        this.setData({ isRefreshing: false });
        wx.showToast({
          title: '请先登录',
          icon: 'none',
          duration: 1500
        });
      }, 500);
    }
  },

  /**
   * 🚨 跳转到我的书籍
   */
  goToMyBooks: function(e) {
    const type = e.currentTarget.dataset.type;
    console.log('跳转到我的书籍，类型:', type);
    
    // 🚨 检查是否有用户ID
    const userId = userStatusManager.getCurrentUserId();
    if (!userId || userId <= 0) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      this.goToLogin();
      return;
    }
    
    let pageTitle = '';
    switch(type) {
      case 'completed':
        pageTitle = '已完成';
        break;
      case 'downloaded':
        pageTitle = '已下载';
        break;
      case 'inProgress':
        pageTitle = '进行中';
        break;
      case 'favorites':
        pageTitle = '我的收藏';
        break;
    }
    
    // 🚨 传递用户ID到我的书籍页面
    wx.navigateTo({
      url: `/pages/my-books/my-books?type=${type}&title=${pageTitle}&userId=${userId}`
    });
  },

  /**
   * 跳转到帮助中心
   */
  goToHelpCenter: function() {
    wx.navigateTo({
      url: '/pages/help/help'
    });
  },

  /**
   * 跳转到意见反馈
   */
  goToFeedback: function() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  },

  /**
   * 跳转到设置
   */
  goToSettings: function() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  },

  /**
   * 跳转到编辑个人信息
   */
  goToEditProfile: function() {
    // 🚨 检查是否有用户ID
    const userId = userStatusManager.getCurrentUserId();
    if (!userId || userId <= 0) {
      this.goToLogin();
      return;
    }
    
    wx.navigateTo({
      url: `/pages/user-info/user-info?from=profile&userId=${userId}`
    });
  },

  /**
   * 跳转到关于我们
   */
  goToAbout: function() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  },

  /**
   * 跳转到登录
   */
  goToLogin: function() {
    console.log('跳转到登录页面');
    
    if (this.data.showExpiredModal) {
      this.setData({ showExpiredModal: false });
    }
    
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const currentRoute = currentPage.route;
    
    wx.navigateTo({
      url: `/pages/login/login?redirect=${encodeURIComponent('/' + currentRoute)}&from=profile`
    });
  },

  /**
   * 跳转到学习记录
   */
  goToLearningHistory: function() {
    // 🚨 检查是否有用户ID
    const userId = userStatusManager.getCurrentUserId();
    if (!userId || userId <= 0) {
      this.goToLogin();
      return;
    }
    
    wx.navigateTo({
      url: `/pages/learning-history/learning-history?userId=${userId}`
    });
  },

  /**
   * 用户卡片点击事件
   */
  onUserCardTap: function() {
    // 🚨 检查是否有用户ID
    const userId = userStatusManager.getCurrentUserId();
    if (!userId || userId <= 0) {
      this.goToLogin();
    } else {
      this.goToEditProfile();
    }
  },

  /**
   * 头像点击事件
   */
  onAvatarTap: function() {
    this.onUserCardTap();
  },

  /**
   * VIP图标点击事件
   */
  onVipIconTap: function() {
    // 🚨 检查是否有用户ID
    const userId = userStatusManager.getCurrentUserId();
    if (!userId || userId <= 0) {
      this.goToLogin();
      return;
    }
    
    if (this.data.userInfo.isVip) {
      wx.showToast({
        title: '您已是VIP会员',
        icon: 'success'
      });
    } else {
      wx.navigateTo({
        url: `/pages/vip/vip?userId=${userId}`
      });
    }
  },

  /**
   * 🚨 退出登录
   */
  logout: function() {
    console.log('退出登录');
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({
              title: '退出中...',
              mask: true
            });
            
            // 🚨 清理本地存储的所有相关数据
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('currentUserId');
            wx.removeStorageSync('studyData'); // 🚨 新增：清理学习数据
            wx.removeStorageSync('bookStats'); // 🚨 新增：清理书籍统计
            
            console.log('🗑️ 所有本地数据已清理');
            
            // 🚨 使用用户状态管理器退出登录
            const result = userStatusManager.logout();
            
            if (result.success) {
              // 更新页面状态
              this.resetToGuestMode();
              
              wx.hideLoading();
              wx.showToast({
                title: '已退出登录',
                icon: 'success',
                duration: 1500
              });
            } else {
              throw new Error(result.error);
            }
            
          } catch (error) {
            console.error('退出登录过程出错:', error);
            wx.hideLoading();
            wx.showToast({
              title: '退出失败',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  /**
   * 手动刷新按钮点击
   */
  onRefreshTap: function() {
    if (this.data.isRefreshing) return;
    
    // 🚨 检查是否有用户ID
    const userId = userStatusManager.getCurrentUserId();
    if (userId && userId > 0) {
      this.loadUserData();
    } else {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 处理登录过期
   */
  handleLoginExpired: function() {
    console.log('🔄 处理登录过期');
    
    this.setData({
      showExpiredModal: true
    });
  },

  /**
   * 重新登录
   */
  reLogin: function() {
    console.log('🔄 重新登录');
    
    this.setData({
      showExpiredModal: false
    });
    
    this.goToLogin();
  },

  /**
   * 关闭过期弹窗
   */
  closeExpiredModal: function() {
    this.setData({
      showExpiredModal: false
    });
  },

  /**
   * 从弹窗跳转到登录
   */
  goToLoginFromModal: function() {
    console.log('从弹窗跳转到登录页面');
    this.setData({ showExpiredModal: false });
    
    setTimeout(() => {
      this.goToLogin();
    }, 300);
  },

  /**
   * 🚨 测试数据验证函数
   */
  testUserData: async function() {
    const userId = userStatusManager.getCurrentUserId();
    
    if (!userId || userId <= 0) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({ title: '验证数据中...' });
    
    try {
      const { cloudAPI } = require('../../utils/uni-cloud.js');
      
      // 分别测试各个接口
      const tests = [
        cloudAPI.study.getUserProfileData({ userId }).catch(e => ({ error: e.message })),
        cloudAPI.study.getBookStats({ userId }).catch(e => ({ error: e.message })),
        cloudAPI.study.getStudyStats({ userId }).catch(e => ({ error: e.message }))
      ];
      
      const results = await Promise.allSettled(tests);
      
      console.log('📋 测试结果:', results);
      
      let message = '数据验证完成：\n';
      const testNames = ['完整数据', '书籍统计', '学习统计'];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (data.error) {
            message += `❌ ${testNames[index]}: 失败 (${data.error})\n`;
          } else if (data.success || data.code === 0) {
            const actualData = data.data || data;
            const dataStr = JSON.stringify(actualData).substring(0, 100);
            message += `✅ ${testNames[index]}: 成功 (${dataStr}...)\n`;
          } else {
            message += `⚠️ ${testNames[index]}: 未知格式 (${JSON.stringify(data).substring(0, 50)}...)\n`;
          }
        } else {
          message += `❌ ${testNames[index]}: 异常 (${result.reason.message})\n`;
        }
      });
      
      wx.hideLoading();
      wx.showModal({
        title: '数据验证结果',
        content: message,
        showCancel: false
      });
      
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '验证失败',
        icon: 'none'
      });
    }
  },

  /**
   * 🚨 模拟添加测试数据（用于调试）
   */
  addTestData: function() {
    console.log('添加测试数据');
    
    const userId = userStatusManager.getCurrentUserId();
    if (!userId || userId <= 0) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    // 模拟一些测试数据
    const testStudyData = {
      totalMinutes: 125,
      booksCount: 3,
      daysCount: 15,
      wordsCount: 1250,
      dailyGoal: 30,
      goalProgress: 65
    };
    
    const testBookStats = {
      completed: 2,
      downloaded: 5,
      favorites: 8,
      inProgress: 3,
      total: 10
    };
    
    // 保存到本地存储
    try {
      wx.setStorageSync('studyData', testStudyData);
      wx.setStorageSync('bookStats', testBookStats);
      
      // 更新页面显示
      this.setData({
        studyData: testStudyData,
        bookStats: testBookStats
      });
      
      wx.showToast({
        title: '测试数据已添加',
        icon: 'success'
      });
      
    } catch (error) {
      console.error('添加测试数据失败:', error);
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      });
    }
  },

  /**
   * 🚨 清除测试数据
   */
  clearTestData: function() {
    console.log('清除测试数据');
    
    try {
      wx.removeStorageSync('studyData');
      wx.removeStorageSync('bookStats');
      
      // 重置为默认值
      this.setData({
        studyData: {
          totalMinutes: 0,
          booksCount: 0,
          daysCount: 0,
          wordsCount: 0,
          dailyGoal: 30,
          goalProgress: 0
        },
        bookStats: {
          completed: 0,
          downloaded: 0,
          favorites: 0,
          inProgress: 0,
          total: 0
        }
      });
      
      wx.showToast({
        title: '测试数据已清除',
        icon: 'success'
      });
      
    } catch (error) {
      console.error('清除测试数据失败:', error);
      wx.showToast({
        title: '清除失败',
        icon: 'none'
      });
    }
  },

  /**
   * 🐛 调试函数：显示存储状态
   */
  debugStorage: function() {
    console.log('🔍 === 开始调试存储状态 ===');
    
    try {
      const debugInfo = userStatusManager.debug();
      
      wx.showModal({
        title: '用户状态调试',
        content: `实例ID: ${debugInfo.instance.currentUserId}\n全局ID: ${debugInfo.global.currentUserId}\n登录状态: ${userStatusManager.isLoggedIn() ? '已登录' : '未登录'}`,
        showCancel: false
      });
      
    } catch (e) {
      console.error('调试存储失败:', e);
      wx.showToast({
        title: '调试失败',
        icon: 'none'
      });
    }
  }
});