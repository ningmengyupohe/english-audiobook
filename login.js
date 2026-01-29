// pages/login/login.js
const { user } = require('../../utils/uni-cloud.js').cloudAPI;
const userStatusManager = require('../../utils/user-status.js'); // 🚨 引入用户状态管理器

Page({
  data: {
    formData: {
      phone: '',
      password: ''
    },
    passwordVisible: false,
    rememberPassword: true,
    canLogin: false,
    isLogging: false,
    redirect: null
  },

  onLoad: function(options) {
    console.log('登录页面加载，参数:', options);
    
    if (options && options.redirect) {
      this.setData({
        redirect: options.redirect
      });
    }
    
    this.loadRememberedAccount();
  },

  onShow: function() {
    console.log('登录页面显示');
  },

  onHide: function() {
    console.log('登录页面隐藏');
  },

  onUnload: function() {
    console.log('登录页面卸载');
  },

  loadRememberedAccount: function() {
    try {
      const remembered = wx.getStorageSync('rememberedAccount');
      console.log('加载记住的账号:', remembered);
      if (remembered && remembered.phone && remembered.password) {
        this.setData({
          formData: {
            phone: remembered.phone,
            password: remembered.password
          },
          rememberPassword: true
        });
        this.checkLoginButton();
      }
    } catch (e) {
      console.error('加载记住的账号失败:', e);
    }
  },

  onPhoneInput: function(e) {
    const value = e.detail.value.replace(/\s/g, '');
    this.setData({
      'formData.phone': value
    });
    this.checkLoginButton();
  },

  onPasswordInput: function(e) {
    const value = e.detail.value;
    this.setData({
      'formData.password': value
    });
    this.checkLoginButton();
  },

  togglePasswordVisible: function() {
    console.log('切换密码可见性，当前状态:', this.data.passwordVisible);
    this.setData({
      passwordVisible: !this.data.passwordVisible
    });
  },

  toggleRemember: function() {
    this.setData({
      rememberPassword: !this.data.rememberPassword
    });
    console.log('记住密码状态:', this.data.rememberPassword);
  },

  checkLoginButton: function() {
    const { phone, password } = this.data.formData;
    const isPhoneValid = /^1[3-9]\d{9}$/.test(phone);
    const isPasswordValid = password && password.length >= 6;
    const canLogin = isPhoneValid && isPasswordValid && !this.data.isLogging;
    
    this.setData({ canLogin });
  },

  onLoginSubmit: function(e) {
    console.log('提交登录表单');
    
    if (!this.data.canLogin || this.data.isLogging) {
      console.log('无法提交登录');
      return;
    }
    
    const formData = e.detail.value;
    const { phone, password } = formData;
    const { rememberPassword } = this.data;
    
    console.log('登录参数:', { 
      phone, 
      password: password.substring(0, 3) + '***', 
      rememberPassword 
    });

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!password || password.length < 6) {
      wx.showToast({
        title: '密码至少6位',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({ isLogging: true });
    
    wx.showLoading({
      title: '登录中...',
      mask: true
    });
    
    // 🚨 调用登录接口
    user.login({
      phone: phone,
      password: password
    }).then(res => {
      console.log('🚨 登录成功响应:', res);
      this.handleLoginSuccess(res, phone, password, rememberPassword);
    }).catch(err => {
      console.error('登录失败:', err);
      this.handleLoginError(err);
    }).finally(() => {
      this.setData({ isLogging: false });
    });
  },

  // 🚨 处理登录成功
  handleLoginSuccess: function(res, phone, password, rememberPassword) {
    wx.hideLoading();
    
    console.log('🔍 解析登录响应:', res);
    
    // 🚨 关键：根据您的后端返回格式，res 现在应该是 {userInfo: {...}, token: '...'}
    let userInfo = null;
    let token = null;
    
    if (res && res.userInfo && res.token) {
      console.log('✅ 直接格式 {userInfo, token}');
      userInfo = res.userInfo;
      token = res.token;
    } else if (res && res.data) {
      // 如果还在 data 中
      console.log('✅ 包装格式 {data: {userInfo, token}}');
      if (res.data.userInfo && res.data.token) {
        userInfo = res.data.userInfo;
        token = res.data.token;
      } else if (res.data._id || res.data.id) {
        console.log('✅ 直接用户信息格式');
        userInfo = res.data;
        token = res.data.token || res.data.accessToken;
      }
    } else if (res && (res._id || res.id)) {
      console.log('✅ 其他直接格式');
      userInfo = res;
      token = res.token || res.accessToken;
    }
    
    console.log('最终解析结果:', {
      hasUserInfo: !!userInfo,
      hasToken: !!token,
      token长度: token ? token.length : 0,
      token预览: token ? token.substring(0, 30) + '...' : '空'
    });
    
    if (!userInfo || !token) {
      console.error('❌ 无法解析登录响应:', res);
      wx.showToast({
        title: '登录响应格式错误',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 🚨 确保用户信息包含必要字段
    if (!userInfo._id && !userInfo.id) {
      console.warn('⚠️ 用户信息缺少ID');
      if (res._id) userInfo._id = res._id;
      if (res.id) userInfo.id = res.id;
    }
    
    if (!userInfo.nickname && !userInfo.username) {
      userInfo.nickname = '用户' + (phone ? phone.substring(7) : '');
    }
    
    console.log('✅ 最终用户信息:', userInfo);
    
    // 🚨 保存登录信息 - 带详细日志和验证
    this.saveLoginInfo(userInfo, token, phone, password, rememberPassword);
  },

  // 🚨 保存登录信息（主要函数）- 增强版，添加学习数据存储
saveLoginInfo: function(userInfo, token, phone, password, rememberPassword) {
    console.log('💾 开始保存登录信息...');
    
    try {
      // 1. 先清理旧数据
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('studyData'); // 🚨 新增：清理学习数据
      wx.removeStorageSync('bookStats'); // 🚨 新增：清理书籍统计
      console.log('✅ 清理旧数据完成');
      
      // 2. 保存token
      console.log('🔐 保存token...');
      wx.setStorageSync('token', token);
      
      // 🚨 验证token是否保存成功
      const storedToken = wx.getStorageSync('token');
      if (storedToken && storedToken === token) {
        console.log('✅ Token保存成功！长度:', token.length);
      } else {
        console.error('❌ Token保存失败！');
        throw new Error('Token存储失败');
      }
      
      // 3. 🚨 关键：提取数字类型的用户ID
      let userIdNumber = 0;
      if (userInfo._id) {
        userIdNumber = Number(userInfo._id);
        console.log('🔍 从 _id 字段获取用户ID:', userInfo._id, '->', userIdNumber);
      } else if (userInfo.id) {
        userIdNumber = Number(userInfo.id);
        console.log('🔍 从 id 字段获取用户ID:', userInfo.id, '->', userIdNumber);
      } else if (userInfo.userId) {
        userIdNumber = Number(userInfo.userId);
        console.log('🔍 从 userId 字段获取用户ID:', userInfo.userId, '->', userIdNumber);
      }
      
      if (isNaN(userIdNumber)) {
        console.error('❌ 用户ID不是有效数字');
        userIdNumber = 0;
      }
      
      // 4. 🚨 构建标准的用户信息对象
      const standardUserInfo = {
        // ID相关字段
        _id: userInfo._id || '',
        id: userInfo.id || '',
        userId: userIdNumber ? userIdNumber.toString() : '',
        userIdNumber: userIdNumber,
        
        // 基本信息
        username: userInfo.username || '',
        nickname: userInfo.nickname || '',
        phone: userInfo.phone || phone,
        email: userInfo.email || '',
        avatar: userInfo.avatar || '/images/avatar/default.png',
        
        // 学习信息
        level: userInfo.level || '初级',
        isVip: userInfo.isVip || false,
        learningDays: userInfo.learningDays || 0,
        
        // 统计信息
        reportCount: userInfo.reportCount || 0,
        likeCount: userInfo.likeCount || 0,
        
        // 状态信息
        status: userInfo.status || '正常',
        
        // 时间信息
        lastLoginTime: userInfo.lastLoginTime || Date.now(),
        createTime: userInfo.createTime || Date.now(),
        updateTime: userInfo.updateTime || Date.now()
      };
      
      console.log('🔍 标准化的用户信息:', standardUserInfo);
      
      // 5. 保存用户信息到本地存储
      wx.setStorageSync('userInfo', standardUserInfo);
      console.log('✅ 用户信息保存成功');
      
      // 6. 🚨 关键：保存初始学习数据到本地存储
      const defaultStudyData = {
        totalMinutes: 0,
        booksCount: 0,
        daysCount: 0,
        wordsCount: 0,
        dailyGoal: 30,
        goalProgress: 0
      };
      
      const defaultBookStats = {
        completed: 0,
        downloaded: 0,
        favorites: 0,
        inProgress: 0,
        total: 0
      };
      
      wx.setStorageSync('studyData', defaultStudyData);
      wx.setStorageSync('bookStats', defaultBookStats);
      console.log('💾 初始学习数据保存成功');
      
      // 7. 🚨 关键：保存用户ID到专用字段
      if (userIdNumber > 0) {
        wx.setStorageSync('currentUserId', userIdNumber);
        console.log('💾 用户ID保存到专用字段:', userIdNumber);
      }
      
      // 8. 记住密码
      if (rememberPassword) {
        try {
          wx.setStorageSync('rememberedAccount', {
            phone: phone,
            password: password
          });
          console.log('✅ 记住密码设置成功');
        } catch (e) {
          console.warn('记住密码设置失败:', e);
        }
      } else {
        try {
          wx.removeStorageSync('rememberedAccount');
        } catch (e) {}
      }
      
      // 9. 🚨 使用用户状态管理器统一管理用户状态
      const saveResult = userStatusManager.loginSuccess({
        ...standardUserInfo,
        token: token
      });
      
      if (!saveResult.success) {
        console.error('❌ 用户状态管理器保存失败:', saveResult.error);
        wx.showToast({
          title: '登录状态保存失败',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      console.log('✅ 用户状态管理器保存成功，用户ID:', saveResult.userId);
      
      // 10. 更新全局数据
      const app = getApp();
      if (app) {
        if (!app.globalData) {
          app.globalData = {};
        }
        app.globalData.token = token;
        app.globalData.userInfo = standardUserInfo;
        app.globalData.currentUserId = userIdNumber;
        app.globalData.hasLogin = true;
        app.globalData.lastLoginTime = Date.now();
        app.globalData.shouldRefreshHome = true;
        app.globalData.shouldRefreshProfile = true;
        
        console.log('✅ 全局数据更新成功');
      }
      
      // 11. 显示成功提示
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          // 12. 跳转前再次验证
          setTimeout(() => {
            this.verifyAndRedirect();
          }, 800);
        }
      });
      
    } catch (storageError) {
      console.error('❌ 保存登录信息失败:', storageError);
      
      // 尝试异步存储作为后备
      this.fallbackSave(token, userInfo, phone, password, rememberPassword);
    }
  },

  // 🚨 后备存储方案
  fallbackSave: function(token, userInfo, phone, password, rememberPassword) {
    console.log('尝试后备存储方案...');
    
    // 异步存储token
    wx.setStorage({
      key: 'token',
      data: token,
      success: () => {
        console.log('✅ 异步存储token成功');
        
        // 异步存储用户信息
        wx.setStorage({
          key: 'userInfo',
          data: userInfo,
          success: () => {
            console.log('✅ 异步存储userInfo成功');
            
            // 使用用户状态管理器
            const saveResult = userStatusManager.loginSuccess({
              ...userInfo,
              token: token
            });
            
            if (saveResult.success) {
              wx.showToast({
                title: '登录成功',
                icon: 'success',
                duration: 1500,
                success: () => {
                  setTimeout(() => {
                    this.verifyAndRedirect();
                  }, 1000);
                }
              });
            } else {
              wx.showToast({
                title: '登录状态保存失败',
                icon: 'none',
                duration: 2000
              });
            }
          },
          fail: (err) => {
            console.error('❌ 异步存储userInfo失败:', err);
            wx.showToast({
              title: '用户信息保存失败',
              icon: 'none',
              duration: 2000
            });
          }
        });
      },
      fail: (err) => {
        console.error('❌ 异步存储token失败:', err);
        wx.showToast({
          title: '登录信息保存失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 🚨 验证并跳转
  verifyAndRedirect: function() {
    console.log('🔍 验证存储状态...');
    
    // 验证token是否真的保存了
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const currentUserId = wx.getStorageSync('currentUserId');
    
    console.log('验证结果:', {
      本地token: token ? '存在' : '空',
      本地token长度: token ? token.length : 0,
      本地userInfo: userInfo ? '存在' : '空',
      本地currentUserId: currentUserId || '空'
    });
    
    // 检查用户状态管理器
    const isLoggedIn = userStatusManager.isLoggedIn();
    console.log('用户状态管理器登录状态:', isLoggedIn);
    
    if (!token || !userInfo || !currentUserId) {
      console.error('❌ 验证失败：关键信息缺失');
      
      // 检查用户状态管理器
      const debugInfo = userStatusManager.debug();
      console.log('用户状态管理器调试信息:', debugInfo);
      
      wx.showModal({
        title: '登录异常',
        content: '登录信息保存失败，请重新登录',
        showCancel: false,
        success: () => {
          // 让用户重试
        }
      });
      return;
    }
    
    console.log('✅ 存储验证通过，准备跳转');
    
    // 延迟跳转，确保数据已保存
    setTimeout(() => {
      this.redirectAfterLogin();
    }, 500);
  },

  // 🚨 登录成功后跳转
  redirectAfterLogin: function() {
    const pages = getCurrentPages();
    console.log('登录后跳转逻辑，页面栈长度:', pages.length);
    
    // 如果有回跳参数
    if (this.data.redirect) {
      const redirectUrl = decodeURIComponent(this.data.redirect);
      console.log('跳转到指定页面:', redirectUrl);
      
      // 检查是否是tab页
      const tabPages = [
        '/pages/index/index',
        '/pages/books/books', 
        '/pages/profile/profile',
        '/pages/home/home'
      ];
      
      const isTabPage = tabPages.some(tab => redirectUrl.includes(tab));
      
      // 🚨 检查是否需要通知目标页面
      const app = getApp();
      if (app.globalData) {
        // 设置页面刷新标记
        app.globalData.shouldRefreshHome = true;
        app.globalData.shouldRefreshProfile = true;
        
        // 发送用户状态变化事件
        app.globalData.userStatusChanged = true;
        app.globalData.lastUserEvent = 'login';
        app.globalData.lastUserEventTime = Date.now();
        
        console.log('🚨 设置页面刷新标记和用户状态变化事件');
      }
      
      if (isTabPage) {
        console.log('跳转到tab页:', redirectUrl);
        wx.switchTab({
          url: redirectUrl,
          success: () => {
            console.log('✅ 跳转到tab页成功');
            
            // 手动触发目标页面的事件
            this.triggerPageEvents(redirectUrl);
          },
          fail: (err) => {
            console.error('跳转到tab页失败:', err);
            wx.switchTab({
              url: '/pages/home/home'
            });
          }
        });
      } else {
        console.log('跳转到普通页面:', redirectUrl);
        wx.redirectTo({
          url: redirectUrl,
          success: () => {
            console.log('✅ 跳转到普通页面成功');
          },
          fail: (err) => {
            console.error('跳转到普通页面失败:', err);
            wx.switchTab({
              url: '/pages/home/home'
            });
          }
        });
      }
    }
    // 如果有上一页，返回上一页
    else if (pages.length > 1) {
      console.log('返回上一页');
      
      // 🚨 设置页面刷新标记
      const app = getApp();
      if (app.globalData) {
        app.globalData.shouldRefreshHome = true;
        app.globalData.shouldRefreshProfile = true;
        app.globalData.userStatusChanged = true;
        app.globalData.lastUserEvent = 'login';
        app.globalData.lastUserEventTime = Date.now();
      }
      
      wx.navigateBack({
        delta: 1,
        success: () => {
          console.log('✅ 返回上一页成功');
        },
        fail: (err) => {
          console.error('返回上一页失败:', err);
          wx.switchTab({
            url: '/pages/home/home'
          });
        }
      });
    } else {
      // 否则跳转到首页
      console.log('跳转到首页');
      
      // 🚨 设置页面刷新标记
      const app = getApp();
      if (app.globalData) {
        app.globalData.shouldRefreshHome = true;
        app.globalData.shouldRefreshProfile = true;
        app.globalData.userStatusChanged = true;
        app.globalData.lastUserEvent = 'login';
        app.globalData.lastUserEventTime = Date.now();
      }
      
      wx.switchTab({
        url: '/pages/home/home',
        success: () => {
          console.log('✅ 跳转到首页成功');
        },
        fail: (err) => {
          console.error('跳转到首页失败:', err);
        }
      });
    }
  },

  // 🚨 触发页面事件
  triggerPageEvents: function(targetUrl) {
    console.log('触发页面事件，目标:', targetUrl);
    
    // 根据目标页面触发不同的事件
    if (targetUrl.includes('/pages/home/home')) {
      console.log('🚨 触发Home页面登录成功事件');
      
      // 可以通过事件总线或全局标记通知
      const app = getApp();
      if (app.globalData) {
        app.globalData.loginSuccessEvent = {
          time: Date.now(),
          userId: userStatusManager.getCurrentUserId()
        };
      }
    } else if (targetUrl.includes('/pages/profile/profile')) {
      console.log('🚨 触发Profile页面登录成功事件');
    }
  },

  // 处理登录错误
  handleLoginError: function(err) {
    wx.hideLoading();
    
    console.error('❌ 登录请求失败:', err);
    
    let errorMsg = '网络错误，请重试';
    
    if (err.status === 401) {
      errorMsg = '手机号或密码错误';
    } else if (err.status === 404) {
      errorMsg = '用户不存在';
    } else if (err.status === 403) {
      errorMsg = '账号已被禁用';
    } else if (err.code === 'NETWORK_ERROR') {
      errorMsg = '网络连接失败';
    } else if (err.message) {
      errorMsg = err.message;
    }
    
    wx.showToast({
      title: errorMsg,
      icon: 'none',
      duration: 2000
    });
  },

  // 🚨 调试函数
  debugStorage: function() {
    console.log('🔍 === 调试存储状态 ===');
    
    try {
      const token = wx.getStorageSync('token');
      const userInfo = wx.getStorageSync('userInfo');
      const currentUserId = wx.getStorageSync('currentUserId');
      const remembered = wx.getStorageSync('rememberedAccount');
      
      console.log('存储状态:', {
        token: token ? token.substring(0, 50) + '...' : '空',
        token长度: token ? token.length : 0,
        userInfo: userInfo ? '存在' : '空',
        currentUserId: currentUserId || '空',
        rememberedAccount: remembered ? '存在' : '空'
      });
      
      // 检查用户状态管理器
      const isLoggedIn = userStatusManager.isLoggedIn();
      const userId = userStatusManager.getCurrentUserId();
      const userInfoFromManager = userStatusManager.getUserInfo();
      
      console.log('用户状态管理器:', {
        登录状态: isLoggedIn,
        用户ID: userId,
        有用户信息: !!userInfoFromManager
      });
      
      const app = getApp();
      if (app && app.globalData) {
        console.log('全局数据:', {
          全局token: app.globalData.token ? app.globalData.token.substring(0, 50) + '...' : '空',
          全局userInfo: app.globalData.userInfo ? '存在' : '空',
          全局currentUserId: app.globalData.currentUserId,
          全局标记: {
            shouldRefreshHome: app.globalData.shouldRefreshHome,
            shouldRefreshProfile: app.globalData.shouldRefreshProfile,
            userStatusChanged: app.globalData.userStatusChanged
          }
        });
      }
      
      wx.showModal({
        title: '存储状态',
        content: `登录状态: ${isLoggedIn ? '已登录' : '未登录'}\n用户ID: ${userId}\nToken: ${token ? '已保存(' + token.length + '字符)' : '未保存'}\n用户信息: ${userInfo ? '已保存' : '未保存'}`,
        showCancel: false
      });
    } catch (e) {
      console.error('调试存储失败:', e);
    }
  },

  goToForgotPassword: function() {
    wx.navigateTo({
      url: '/pages/forgot-password/forgot-password'
    });
  },

  goToRegister: function() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },

  goToUserAgreement: function() {
    wx.navigateTo({
      url: '/pages/webview/webview?title=用户协议&url=https://www.example.com/user-agreement'
    });
  },

  goToPrivacyPolicy: function() {
    wx.navigateTo({
      url: '/pages/webview/webview?title=隐私政策&url=https://www.example.com/privacy-policy'
    });
  },

  goBack: function() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({
        url: '/pages/home/home'
      });
    }
  },

  // 🚨 清理所有存储（调试用）
  clearAllStorage: function() {
    console.log('🗑️ 清理所有存储');
    wx.showModal({
      title: '确认清理',
      content: '确定要清理所有本地存储数据吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清理本地存储
            wx.clearStorageSync();
            
            // 清理用户状态管理器
            userStatusManager.logout();
            
            // 清理全局数据
            const app = getApp();
            if (app.globalData) {
              app.globalData.token = null;
              app.globalData.userInfo = null;
              app.globalData.currentUserId = null;
              app.globalData.hasLogin = false;
              app.globalData.shouldRefreshHome = false;
              app.globalData.shouldRefreshProfile = false;
            }
            
            wx.showToast({
              title: '清理成功',
              icon: 'success'
            });
            
            console.log('✅ 所有存储已清理');
          } catch (e) {
            console.error('清理存储失败:', e);
          }
        }
      }
    });
  }
});