// pages/register/register.js

// 导入云函数API
const cloudAPI = require('../../utils/uni-cloud.js').cloudAPI;

Page({
  data: {
    formData: {
      phone: '',
      password: '',
      confirmPassword: '',
      username: '',
      email: '',
    },
    passwordVisible: false,
    confirmPasswordVisible: false,
    agreementAccepted: false,
    
    // 表单验证状态
    phoneValid: true,
    passwordValid: true,
    passwordMatch: true,
    usernameValid: true,
    emailValid: true,
    
    canRegister: false,
    isRegistering: false,
  },

  onLoad: function(options) {
    console.log('=== 🛠️ 域名配置诊断开始 ===');
    console.log('1. 后台配置的域名:', 'https://fc-mp-22bc083a-75be-471b-a448-e1e547b31823.next.bspapp.com');
    console.log('2. 代码中实际请求的URL将在注册时打印，请查看下一步日志');
    console.log('3. 导入的 cloudAPI:', cloudAPI ? '✅ 导入成功' : '❌ 导入失败');
    console.log('=== 🛠️ 诊断结束 ===');
    
    this.checkLastRegistered();
  },

  checkLastRegistered: function() {
    try {
      const lastPhone = wx.getStorageSync('lastRegisteredPhone');
      if (lastPhone) {
        this.setData({
          'formData.phone': lastPhone
        }, () => {
          this.checkPhoneValidation(lastPhone);
        });
      }
    } catch (e) {
      console.error('检查上次注册手机号失败:', e);
    }
  },

  onPhoneInput: function(e) {
    const value = e.detail.value.replace(/\s/g, '');
    this.checkPhoneValidation(value);
  },

  checkPhoneValidation: function(value) {
    const phoneValid = /^1[3-9]\d{9}$/.test(value);
    
    this.setData({
      'formData.phone': value,
      phoneValid
    }, () => {
      this.checkRegisterButton();
    });
  },

  onUsernameInput: function(e) {
    const value = e.detail.value;
    const usernameValid = value.length >= 2 && value.length <= 20;
    
    this.setData({
      'formData.username': value,
      usernameValid
    }, () => {
      this.checkRegisterButton();
    });
  },

  onEmailInput: function(e) {
    const value = e.detail.value;
    const emailValid = !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    
    this.setData({
      'formData.email': value,
      emailValid
    }, () => {
      this.checkRegisterButton();
    });
  },

  onPasswordInput: function(e) {
    const value = e.detail.value;
    const passwordValid = value.length >= 6 && value.length <= 20;
    
    this.setData({
      'formData.password': value,
      passwordValid
    }, () => {
      this.checkPasswordMatch();
      this.checkRegisterButton();
    });
  },

  onConfirmPasswordInput: function(e) {
    const value = e.detail.value;
    
    this.setData({
      'formData.confirmPassword': value
    }, () => {
      this.checkPasswordMatch();
      this.checkRegisterButton();
    });
  },

  togglePasswordVisible: function() {
    this.setData({
      passwordVisible: !this.data.passwordVisible
    });
  },

  toggleConfirmPasswordVisible: function() {
    this.setData({
      confirmPasswordVisible: !this.data.confirmPasswordVisible
    });
  },

  toggleAgreement: function() {
    this.setData({
      agreementAccepted: !this.data.agreementAccepted
    }, () => {
      this.checkRegisterButton();
    });
  },

  checkPasswordMatch: function() {
    const { password, confirmPassword } = this.data.formData;
    const passwordMatch = password === confirmPassword;
    
    this.setData({
      passwordMatch
    });
  },

  checkRegisterButton: function() {
    const { phone, password, confirmPassword, username } = this.data.formData;
    const { 
      agreementAccepted, 
      phoneValid, 
      passwordValid, 
      passwordMatch,
      usernameValid,
      emailValid
    } = this.data;
    
    let canRegister = false;
    
    if (phone && password && confirmPassword && username) {
      if (phoneValid && passwordValid && passwordMatch && 
          usernameValid && emailValid && agreementAccepted) {
        canRegister = true;
      }
    }
    
    this.setData({ 
      canRegister,
      isRegistering: false
    });
  },

  onRegisterSubmit: function(e) {
    if (!this.data.canRegister || this.data.isRegistering) {
      wx.showToast({
        title: '请填写完整的注册信息',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    const formData = e.detail.value;
    const { phone, password, confirmPassword } = formData;
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (password.length < 6) {
      wx.showToast({
        title: '密码至少6位',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (password !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!this.data.agreementAccepted) {
      wx.showToast({
        title: '请阅读并同意用户协议',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({ isRegistering: true });
    
    wx.showLoading({
      title: '注册中...',
      mask: true
    });
    
    const registerData = {
      phone: phone,
      password: password,
      username: formData.username,
      email: formData.email || '',
      level: '初级'
    };
    
    console.log('=== 🔍 注册请求详情 ===');
    console.log('1. 注册数据:', { ...registerData, password: '***' });
    console.log('2. 即将调用: cloudAPI.user.register()');
    console.log('3. cloudAPI.user:', cloudAPI.user);
    console.log('4. cloudAPI.user.register:', cloudAPI.user ? cloudAPI.user.register : 'undefined');
    console.log('5. 请稍后在Console查看实际请求的完整URL');
    
    // 确保 cloudAPI.user.register 存在
    if (!cloudAPI || !cloudAPI.user || typeof cloudAPI.user.register !== 'function') {
      wx.hideLoading();
      this.setData({ isRegistering: false });
      console.error('❌ cloudAPI.user.register 不是有效的函数');
      wx.showToast({
        title: '系统配置错误，请联系管理员',
        icon: 'none',
        duration: 3000
      });
      return;
    }
    
    cloudAPI.user.register(registerData)
      .then(res => {
        console.log('注册响应成功:', res);
        this.handleRegisterSuccess(res, phone, password);
      })
      .catch(err => {
        console.error('注册请求失败详情:', err);
        this.handleRegisterError(err);
      });
  },

  // 处理注册成功
  handleRegisterSuccess: function(res, phone, password) {
    wx.hideLoading();
    
    console.log('=== 🎯 注册响应详细分析 ===');
    console.log('完整响应:', JSON.stringify(res, null, 2));
    
    // 处理不同的响应格式
    if (res && res.code === 200) {
      // 格式1: {code: 200, data: {...}} - UniCloud标准格式
      console.log('✅ 响应格式: code 200 标准格式');
      
      if (res.data && res.data.userInfo) {
        wx.setStorageSync('userInfo', res.data.userInfo);
      }
      
      wx.setStorageSync('lastRegisteredPhone', phone);
      
      wx.showToast({
        title: '注册成功',
        icon: 'success',
        duration: 1500
      });
      
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/login/login?phone=${encodeURIComponent(phone)}&username=${encodeURIComponent(this.data.formData.username)}`
        });
      }, 1500);
      
    } else if (res && res.success === true) {
      // 格式2: {success: true, data: {...}} - 业务成功格式
      console.log('✅ 响应格式: success true 业务格式');
      
      wx.setStorageSync('lastRegisteredPhone', phone);
      
      wx.showToast({
        title: '注册成功',
        icon: 'success',
        duration: 1500
      });
      
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/login/login?phone=${encodeURIComponent(phone)}&username=${encodeURIComponent(this.data.formData.username)}`
        });
      }, 1500);
      
    } else if (res && res.success === false) {
      // 格式3: {success: false, error: {...}} - 业务失败格式
      console.log('⚠️ 响应格式: success false 业务失败');
      console.log('错误详情:', res.error);
      
      let errorMsg = '注册失败';
      if (res.error && res.error.message) {
        errorMsg = res.error.message;
      } else if (res.error && typeof res.error === 'string') {
        errorMsg = res.error;
      } else if (res.message) {
        errorMsg = res.message;
      }
      
      // 常见的注册失败原因
      if (errorMsg.includes('手机号') || errorMsg.includes('已存在') || errorMsg.includes('已注册')) {
        errorMsg = '该手机号已被注册';
      } else if (errorMsg.includes('用户名') || errorMsg.includes('昵称')) {
        errorMsg = '该用户名已被使用';
      } else if (errorMsg.includes('密码')) {
        errorMsg = '密码不符合要求';
      } else if (errorMsg.includes('邮箱')) {
        errorMsg = '邮箱格式不正确或已被使用';
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 3000
      });
      this.setData({ isRegistering: false });
      
    } else if (res && res.errCode) {
      // 格式4: {errCode: xxx, errMsg: 'xxx'} - 错误格式
      console.log('⚠️ 响应格式: errCode 错误格式');
      
      let errorMsg = res.errMsg || '注册失败';
      if (res.errCode === 10001 || res.errCode === 'USER_EXISTS') {
        errorMsg = '该手机号或用户名已被注册';
      } else if (res.errCode === 10002 || res.errCode === 'INVALID_PARAM') {
        errorMsg = '注册信息有误，请检查';
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 3000
      });
      this.setData({ isRegistering: false });
      
    } else {
      // 未知格式
      console.log('❓ 响应格式: 未知格式');
      
      let errorMsg = '注册失败';
      if (res && res.message) {
        errorMsg = res.message;
      } else if (res && typeof res === 'string') {
        errorMsg = res;
      }
      
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      });
      this.setData({ isRegistering: false });
    }
  },

  // 处理注册错误（网络错误等）
  handleRegisterError: function(err) {
    wx.hideLoading();
    this.setData({ isRegistering: false });
    
    console.log('=== ❌ 网络错误分析 ===');
    console.log('完整错误对象:', JSON.stringify(err, null, 2));
    
    let errorMsg = '注册失败，请稍后重试';
    
    if (err.status === 400) {
      if (err.data && err.data.message) {
        errorMsg = err.data.message;
      } else {
        errorMsg = '请求参数错误';
      }
    } else if (err.status === 401) {
      errorMsg = '认证失败，请重新登录';
    } else if (err.status === 403) {
      errorMsg = '权限不足';
    } else if (err.status === 404) {
      errorMsg = '服务未找到';
    } else if (err.status === 409) {
      errorMsg = '该手机号或用户名已被注册';
    } else if (err.status === 500) {
      errorMsg = '服务器内部错误';
    } else if (err.code === 'NETWORK_ERROR' || err.errMsg === 'request:fail') {
      if (err.errMsg && err.errMsg.includes('url not in domain list')) {
        errorMsg = '域名配置错误，请联系管理员';
        console.error('⚠️ 域名不匹配！请核对域名配置');
      } else {
        errorMsg = '网络连接失败，请检查网络';
      }
    } else if (err.message && err.message.includes('手机号')) {
      errorMsg = err.message;
    } else if (err.message) {
      errorMsg = err.message;
    }
    
    wx.showToast({
      title: errorMsg,
      icon: 'none',
      duration: 3000
    });
  },

  goBack: function() {
    wx.navigateBack();
  },

  goToLogin: function() {
    const { phone, username } = this.data.formData;
    let url = '/pages/login/login';
    
    if (phone) {
      url += `?phone=${encodeURIComponent(phone)}`;
      if (username) {
        url += `&username=${encodeURIComponent(username)}`;
      }
    }
    
    wx.redirectTo({
      url: url
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

  // 调试函数：查看云函数详细响应
  debugResponse: function() {
    console.log('=== 🔧 调试云函数响应 ===');
    const testData = {
      phone: '13800138000',
      password: 'test123',
      username: '测试用户',
      email: 'test@example.com',
      level: '初级'
    };
    
    wx.showLoading({ title: '测试中...' });
    
    cloudAPI.user.register(testData)
      .then(res => {
        wx.hideLoading();
        console.log('测试响应:', JSON.stringify(res, null, 2));
        wx.showToast({
          title: '测试完成，查看控制台',
          icon: 'none',
          duration: 3000
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('测试错误:', err);
        wx.showToast({
          title: '测试失败',
          icon: 'none',
          duration: 3000
        });
      });
  }
});