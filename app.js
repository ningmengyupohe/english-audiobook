// app.js
App({
    onLaunch: function () {
      console.log('🚀 小程序启动');
      
      // 🚨 修复：先初始化全局数据
      this.globalData = {
        // 用户相关
        token: null,
        userInfo: null,
        
        // 页面通信标记
        userStatusChanged: false,
        lastUserEvent: null,
        lastUserEventTime: 0,
        shouldRefreshHome: false,
        shouldRefreshProfile: false,
        
        // 原有数据
        selectedTemplate: null,
        appVersion: '1.0.0',
        lastLaunchTime: new Date().toISOString()
      };
      
      console.log('✅ 全局数据初始化完成');
      
      // 🚨 修复：同步登录状态
      this.syncLoginState();
      
      // 检查是否支持 uniCloud
      if (typeof uni !== 'undefined' && uni.cloud) {
        console.log('检测到 uniCloud 环境');
        try {
          uni.cloud.init({
            provider: 'aliyun',
            spaceId: 'mp-22bc083a-75be-471b-a448-e1e547b31823',
            clientSecret: '4Im1p7/yE0EzdkpUgpguNw==',
          });
          console.log('uniCloud 初始化成功');
        } catch (error) {
          console.error('uniCloud 初始化失败:', error);
        }
      } else {
        console.log('当前环境不支持 uniCloud');
      }
      
      // 获取用户信息（如果需要）
      wx.getSetting({
        success: res => {
          if (res.authSetting['scope.userInfo']) {
            // 已经授权，可以直接获取用户信息
            wx.getUserInfo({
              success: res => {
                this.globalData.userInfo = res.userInfo;
                console.log('用户信息获取成功:', res.userInfo);
              },
              fail: err => {
                console.error('获取用户信息失败:', err);
              }
            });
          } else {
            console.log('用户未授权');
          }
        },
        fail: err => {
          console.error('获取设置失败:', err);
        }
      });
      
      console.log('🎯 小程序初始化完成');
    },
  
    onShow: function (options) {
      console.log('📱 小程序显示', options);
    },
  
    onHide: function () {
      console.log('💤 小程序隐藏');
    },
  
    // 🚨 新增：同步登录状态函数
    syncLoginState: function() {
      try {
        console.log('🔄 同步登录状态...');
        
        // 从存储中加载token和userInfo
        const token = wx.getStorageSync('token');
        const userInfo = wx.getStorageSync('userInfo');
        
        console.log('🔍 从存储加载:', {
          token存在: !!token,
          token内容: token ? token.substring(0, 20) + '...' : '空',
          userInfo存在: !!userInfo
        });
        
        // 同步到全局数据
        if (token) {
          this.globalData.token = token;
        }
        if (userInfo) {
          this.globalData.userInfo = userInfo;
        }
        
        // 🚨 确保数据一致性
        if (token && userInfo) {
          console.log('✅ 登录状态已同步到全局');
        } else if (!token && userInfo) {
          console.warn('⚠️ 有userInfo但没有token，可能登录状态不完整');
        } else if (token && !userInfo) {
          console.warn('⚠️ 有token但没有userInfo，可能登录状态不完整');
        }
        
        return {
          token: token,
          userInfo: userInfo
        };
        
      } catch (error) {
        console.error('❌ 同步登录状态失败:', error);
        return null;
      }
    },
    
    // 🚨 新增：更新登录状态函数
    updateLoginState: function(token, userInfo) {
      try {
        console.log('🔄 更新登录状态...');
        
        // 保存到本地存储
        if (token) {
          wx.setStorageSync('token', token);
          this.globalData.token = token;
          console.log('✅ token已保存:', token.substring(0, 20) + '...');
        }
        if (userInfo) {
          wx.setStorageSync('userInfo', userInfo);
          this.globalData.userInfo = userInfo;
          console.log('✅ userInfo已保存');
        }
        
        console.log('✅ 登录状态已更新');
        return true;
      } catch (error) {
        console.error('❌ 更新登录状态失败:', error);
        return false;
      }
    },
    
    // 🚨 新增：清除登录状态函数
    clearLoginState: function() {
      try {
        console.log('🔄 清除登录状态...');
        
        // 清除本地存储
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        
        // 清除全局数据
        this.globalData.token = null;
        this.globalData.userInfo = null;
        
        console.log('✅ 登录状态已清除');
        return true;
      } catch (error) {
        console.error('❌ 清除登录状态失败:', error);
        return false;
      }
    },
  
    globalData: {
      // 用户相关
      token: null,
      userInfo: null,
      
      // 页面通信标记
      userStatusChanged: false,
      lastUserEvent: null,
      lastUserEventTime: 0,
      shouldRefreshHome: false,
      shouldRefreshProfile: false,
      
      // 原有数据
      selectedTemplate: null,
      appVersion: '1.0.0',
      lastLaunchTime: null
    }
  });