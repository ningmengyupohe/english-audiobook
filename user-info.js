// pages/user-info/user-info.js
const { cloudAPI } = require('../../utils/uni-cloud.js')
const app = getApp()

Page({
  data: {
    // 用户信息
    userInfo: {
      avatar: '/images/avatar/default.png',
      nickname: '',
      userId: '',
      level: '初级',
      phone: '',
      isVip: false,
      learningDays: 0
    },
    
    // 原始信息（用于比较是否有变化）
    originalInfo: {},
    
    // 英语水平选项
    levelList: ['初级', '中级', '高级'],
    selectedLevelIndex: 0,
    
    // 修改状态
    hasChanges: false,
    isLoading: false,
    isSaving: false,
    
    // 手机验证弹窗
    showPhoneModal: false,
    phoneForm: {
      oldPhone: '',
      newPhone: ''
    },
    isVerifyingPhone: false,
    
    // 密码修改弹窗
    showPasswordModal: false,
    passwordForm: {
      phone: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    },
    isChangingPassword: false
  },

  onLoad: function(options) {
    console.log('个人信息页面加载');
    this.loadUserInfo();
  },

  onShow: function() {
    console.log('个人信息页面显示');
  },

  /**
   * 加载用户信息
   */
  loadUserInfo: function() {
    const appUserInfo = app.globalData.userInfo;
    const storedUserInfo = wx.getStorageSync('userInfo');
    
    if (appUserInfo || storedUserInfo) {
      const userInfo = appUserInfo || storedUserInfo;
      
      // 设置用户信息
      const userData = {
        avatar: userInfo.avatar || '/images/avatar/default.png',
        nickname: userInfo.nickname || userInfo.username || '',
        userId: userInfo._id || userInfo.userId || '',
        level: userInfo.level || '初级',
        phone: userInfo.phone || '',
        isVip: userInfo.isVip || false,
        learningDays: userInfo.learningDays || 0
      };
      
      // 设置选中的水平索引
      const levelIndex = this.data.levelList.indexOf(userData.level);
      const selectedLevelIndex = levelIndex !== -1 ? levelIndex : 0;
      
      this.setData({
        userInfo: userData,
        originalInfo: {
          avatar: userData.avatar,
          nickname: userData.nickname,
          level: userData.level
        },
        selectedLevelIndex: selectedLevelIndex,
        'passwordForm.phone': userData.phone || ''
      });
    }
  },

  /**
   * 检查是否有修改
   */
  checkChanges: function() {
    const { userInfo, originalInfo } = this.data;
    const hasChanges = (
      userInfo.avatar !== originalInfo.avatar ||
      userInfo.nickname !== originalInfo.nickname ||
      userInfo.level !== originalInfo.level
    );
    
    this.setData({ hasChanges });
  },

  /**
   * 选择头像
   */
  chooseAvatar: function() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        console.log('选择的图片:', tempFilePath);
        
        // 上传图片到服务器
        this.uploadAvatar(tempFilePath);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 上传头像
   */
  uploadAvatar: function(filePath) {
    wx.showLoading({
      title: '上传中...',
      mask: true
    });
    
    // 这里需要实现实际上传逻辑
    // 由于没有实际的云存储，这里模拟上传成功
    setTimeout(() => {
      wx.hideLoading();
      
      // 更新本地头像
      this.setData({
        'userInfo.avatar': filePath
      });
      
      this.checkChanges();
      
      wx.showToast({
        title: '头像更新成功',
        icon: 'success',
        duration: 2000
      });
      
    }, 1500);
  },

  /**
   * 昵称输入
   */
  onNicknameInput: function(e) {
    const nickname = e.detail.value.trim();
    this.setData({
      'userInfo.nickname': nickname
    });
    this.checkChanges();
  },

  /**
   * 英语水平选择
   */
  onLevelChange: function(e) {
    const index = e.detail.value;
    const level = this.data.levelList[index];
    
    this.setData({
      selectedLevelIndex: index,
      'userInfo.level': level
    });
    this.checkChanges();
  },

  /**
   * 显示手机验证弹窗
   */
  showPhoneVerifyModal: function() {
    this.setData({
      showPhoneModal: true,
      phoneForm: {
        oldPhone: '',
        newPhone: ''
      }
    });
  },

  /**
   * 隐藏手机验证弹窗
   */
  hidePhoneModal: function() {
    this.setData({
      showPhoneModal: false
    });
  },

  /**
   * 原手机号输入
   */
  onOldPhoneInput: function(e) {
    this.setData({
      'phoneForm.oldPhone': e.detail.value
    });
  },

  /**
   * 新手机号输入
   */
  onNewPhoneInput: function(e) {
    this.setData({
      'phoneForm.newPhone': e.detail.value
    });
  },

  /**
   * 验证并修改手机号
   */
  verifyPhoneChange: function() {
    const { oldPhone, newPhone } = this.data.phoneForm;
    const currentPhone = this.data.userInfo.phone;
    
    // 验证输入
    if (!oldPhone) {
      wx.showToast({
        title: '请输入原手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!newPhone) {
      wx.showToast({
        title: '请输入新手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      wx.showToast({
        title: '新手机号格式不正确',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 验证原手机号是否正确
    if (oldPhone !== currentPhone) {
      wx.showToast({
        title: '原手机号不正确',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 检查是否与原手机号相同
    if (newPhone === currentPhone) {
      wx.showToast({
        title: '新手机号与原手机号相同',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({ isVerifyingPhone: true });
    
    // 调用API修改手机号
    this.updatePhoneNumber(newPhone);
  },

  /**
   * 更新手机号 - 修复this上下文问题
   */
  updatePhoneNumber: async function(newPhone) {
    try {
      // 调用API更新手机号
      await cloudAPI.user.updateInfo({
        phone: newPhone
      });
      
      // 更新本地数据
      this.setData({
        'userInfo.phone': newPhone,
        'passwordForm.phone': newPhone,
        showPhoneModal: false,
        isVerifyingPhone: false
      });
      
      // 更新全局数据
      const updatedUserInfo = {
        ...app.globalData.userInfo,
        phone: newPhone
      };
      app.globalData.userInfo = updatedUserInfo;
      wx.setStorageSync('userInfo', updatedUserInfo);
      
      wx.showToast({
        title: '手机号修改成功',
        icon: 'success',
        duration: 2000
      });
      
    } catch (error) {
      console.error('修改手机号失败:', error);
      this.setData({ isVerifyingPhone: false });
      
      // 错误处理
      let errorMsg = '修改失败';
      if (error.message) {
        errorMsg = error.message;
      } else if (error.code === 'NETWORK_ERROR') {
        errorMsg = '网络连接失败';
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 显示密码修改弹窗
   */
  showPasswordModal: function() {
    if (!this.data.userInfo.phone) {
      wx.showToast({
        title: '请先绑定手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({
      showPasswordModal: true,
      passwordForm: {
        phone: this.data.userInfo.phone,
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
    });
  },

  /**
   * 隐藏密码修改弹窗
   */
  hidePasswordModal: function() {
    this.setData({
      showPasswordModal: false
    });
  },

  /**
   * 旧密码输入
   */
  onOldPasswordInput: function(e) {
    this.setData({
      'passwordForm.oldPassword': e.detail.value
    });
  },

  /**
   * 新密码输入
   */
  onNewPasswordInput: function(e) {
    this.setData({
      'passwordForm.newPassword': e.detail.value
    });
  },

  /**
   * 确认密码输入
   */
  onConfirmPasswordInput: function(e) {
    this.setData({
      'passwordForm.confirmPassword': e.detail.value
    });
  },

  /**
   * 修改密码
   */
  changePassword: function() {
    const { oldPassword, newPassword, confirmPassword } = this.data.passwordForm;
    
    // 验证输入
    if (!oldPassword) {
      wx.showToast({
        title: '请输入旧密码',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!newPassword) {
      wx.showToast({
        title: '请输入新密码',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (newPassword.length < 6 || newPassword.length > 20) {
      wx.showToast({
        title: '新密码长度应为6-20位',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次输入的新密码不一致',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({ isChangingPassword: true });
    
    // 调用API修改密码
    this.updatePassword(oldPassword, newPassword);
  },

  /**
   * 更新密码 - 修复this上下文问题
   */
  updatePassword: async function(oldPassword, newPassword) {
    try {
      // 调用API修改密码
      await cloudAPI.user.updateInfo({
        oldPassword: oldPassword,
        newPassword: newPassword
      });
      
      this.setData({
        showPasswordModal: false,
        isChangingPassword: false
      });
      
      wx.showToast({
        title: '密码修改成功',
        icon: 'success',
        duration: 2000
      });
      
    } catch (error) {
      console.error('修改密码失败:', error);
      this.setData({ isChangingPassword: false });
      
      // 错误处理
      let errorMsg = '修改失败';
      if (error.message) {
        errorMsg = error.message;
      } else if (error.code === 401 || error.status === 401) {
        errorMsg = '旧密码错误';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMsg = '网络连接失败';
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 保存所有修改
   */
  saveChanges: function() {
    const { userInfo, originalInfo } = this.data;
    const updates = {};
    
    // 收集需要更新的字段
    if (userInfo.nickname !== originalInfo.nickname) {
      updates.nickname = userInfo.nickname;
    }
    
    if (userInfo.level !== originalInfo.level) {
      updates.level = userInfo.level;
    }
    
    if (userInfo.avatar !== originalInfo.avatar && userInfo.avatar.startsWith('http')) {
      updates.avatar = userInfo.avatar;
    }
    
    // 如果没有需要更新的内容
    if (Object.keys(updates).length === 0) {
      wx.showToast({
        title: '没有需要保存的修改',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({ isSaving: true });
    
    // 调用API保存修改
    this.saveUserInfo(updates);
  },

  /**
   * 保存用户信息 - 修复this上下文问题
   */
  saveUserInfo: async function(updates) {
    try {
      // 调用API更新用户信息
      await cloudAPI.user.updateInfo(updates);
      
      // 更新本地数据
      const updatedUserInfo = {
        ...app.globalData.userInfo,
        ...updates
      };
      
      // 更新全局数据和本地存储
      app.globalData.userInfo = updatedUserInfo;
      wx.setStorageSync('userInfo', updatedUserInfo);
      
      // 更新页面数据
      this.setData({
        originalInfo: {
          avatar: updatedUserInfo.avatar || this.data.originalInfo.avatar,
          nickname: updatedUserInfo.nickname || this.data.originalInfo.nickname,
          level: updatedUserInfo.level || this.data.originalInfo.level
        },
        hasChanges: false,
        isSaving: false
      });
      
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      });
      
      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      
    } catch (error) {
      console.error('保存用户信息失败:', error);
      this.setData({ isSaving: false });
      
      // 错误处理
      let errorMsg = '保存失败';
      if (error.message) {
        errorMsg = error.message;
      } else if (error.code === 'NETWORK_ERROR') {
        errorMsg = '网络连接失败';
      } else if (error.code === 401 || error.status === 401) {
        errorMsg = '登录已过期，请重新登录';
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation: function() {
    return;
  },

  /**
   * 返回上一页
   */
  goBack: function() {
    if (this.data.hasChanges) {
      wx.showModal({
        title: '提示',
        content: '您有未保存的修改，确定要返回吗？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        }
      });
    } else {
      wx.navigateBack();
    }
  }
});