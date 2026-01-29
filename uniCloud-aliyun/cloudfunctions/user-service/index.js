// cloudfunctions/user-service/index.js
'use strict';
const db = uniCloud.database();

// 导入公共模块
const Response = require('./common/response');
const Utils = require('./common/utils');
const Auth = require('./common/auth');

exports.main = async (event, context) => {
  console.log('=== 🚨 用户服务调用开始 ===');
  console.log('完整的event对象:', JSON.stringify(event, null, 2));
  console.log('event.body:', event.body);
  console.log('event.action:', event.action);
  console.log('event.data:', event.data);
  
  // 🚨 关键修复：正确处理不同格式的参数
  let action, data;
  
  // 情况1：参数直接在 event 中（旧格式）
  if (event.action !== undefined) {
    console.log('🔍 使用旧格式参数');
    action = event.action;
    data = event.data || {};
  } 
  // 情况2：参数在 event.body 中（新格式）
  else if (event.body !== undefined) {
    console.log('🔍 使用新格式参数（event.body）');
    try {
      // 解析 body
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      console.log('解析后的body:', body);
      
      action = body.action;
      data = body;
      
      // 如果 action 在 data 中，从 data 中移除
      if (data.action) {
        delete data.action;
      }
    } catch (e) {
      console.error('❌ 解析body失败:', e);
      return Response.error('参数格式错误', 400);
    }
  } 
  // 情况3：参数是根级对象
  else {
    console.log('🔍 尝试将整个event作为参数');
    // 检查 event 是否有 action 字段
    if (event.action !== undefined) {
      action = event.action;
      data = { ...event };
      delete data.action;
    } else {
      console.error('❌ 无法识别参数格式');
      return Response.error('参数格式错误', 400);
    }
  }
  
  console.log('📌 最终解析结果:');
  console.log('  action:', action);
  console.log('  data:', JSON.stringify(data));
  
  try {
    // 公开接口（不需要登录）
    const publicActions = ['login', 'register', 'sendSmsCode', 'debugCheckToken']; // 🚨 添加调试接口
    
    console.log('🔍 检查是否需要登录验证...');
    console.log(`action: "${action}", 在publicActions中: ${publicActions.includes(action)}`);
    
    // 需要登录的接口
    if (!publicActions.includes(action)) {
      console.log('🔐 需要登录验证，调用Auth.middleware');
      try {
        const user = await Auth.middleware(event);
        event.user = user; // 将用户信息添加到 event
        console.log('✅ 登录验证成功，用户ID:', user._id);
      } catch (authError) {
        console.log('❌ 登录验证失败:', authError.message);
        throw authError;
      }
    } else {
      console.log('🔓 公开接口，跳过登录验证');
    }

    // 路由到对应的处理函数
    console.log(`🚦 路由到处理函数: ${action}`);
    switch (action) {
      case 'login':
        console.log('➡️ 跳转到login函数');
        return await login(data);
      case 'debugCheckToken': // 🚨 添加调试接口
        console.log('➡️ 跳转到debugCheckToken函数');
        return await debugCheckToken(data);
      case 'register':
        console.log('➡️ 跳转到register函数');
        return await register(data);
      case 'getUserInfo':
        console.log('➡️ 跳转到getUserInfo函数');
        return await getUserInfo(event.user._id);
      case 'updateProfile':
        console.log('➡️ 跳转到updateProfile函数');
        return await updateProfile(event.user._id, data);
      case 'changePassword':
        console.log('➡️ 跳转到changePassword函数');
        return await changePassword(event.user._id, data);
      case 'logout':
        console.log('➡️ 跳转到logout函数');
        return await logout(event.user._id);
      default:
        console.log('❌ 未知的操作类型:', action);
        return Response.error('未知的操作类型', 400);
    }
  } catch (error) {
    console.error('=== ❌ 用户服务错误 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('发生错误的action:', action);
    console.error('========================');
    return Response.error(error.message || '服务器内部错误');
  }
};

// 🚨 添加调试函数
async function debugCheckToken(data) {
  console.log('🔍 === 调试Token检查 ===');
  
  const { token, userId } = data || {};
  
  if (!token && !userId) {
    return Response.error('需要token或userId');
  }
  
  const userCollection = db.collection('user');
  let query = {};
  
  if (token) {
    // 清理token
    let cleanToken = token;
    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.substring(7);
    }
    query.token = cleanToken;
    console.log('🔍 使用token查询:', cleanToken.substring(0, 50) + '...');
  } else if (userId) {
    query._id = userId;
    console.log('🔍 使用用户ID查询:', userId);
  }
  
  const result = await userCollection.where(query).get();
  
  console.log('📊 查询结果:', {
    找到记录数: result.data.length,
    记录: result.data.map(user => ({
      _id: user._id,
      username: user.username,
      phone: user.phone,
      token: user.token ? user.token.substring(0, 50) + '...' : '空',
      token长度: user.token ? user.token.length : 0,
      lastLoginTime: user.lastLoginTime,
      lastLoginDate: user.lastLoginTime ? new Date(user.lastLoginTime).toISOString() : '空',
      updateTime: user.updateTime
    }))
  });
  
  if (result.data.length === 0) {
    return Response.error('未找到匹配的用户');
  }
  
  const user = result.data[0];
  const currentTime = Date.now();
  const tokenAge = user.lastLoginTime ? currentTime - user.lastLoginTime : Infinity;
  const tokenExpireTime = 24 * 60 * 60 * 1000; // 24小时
  
  return Response.success({
    用户ID: user._id,
    用户名: user.username,
    手机号: user.phone,
    token存在: !!user.token,
    token长度: user.token ? user.token.length : 0,
    token预览: user.token ? user.token.substring(0, 30) + '...' : '空',
    最后登录时间: user.lastLoginTime,
    最后登录时间格式化: user.lastLoginTime ? new Date(user.lastLoginTime).toISOString() : '无',
    token有效期: tokenAge,
    token是否过期: tokenAge > tokenExpireTime,
    当前时间: currentTime,
    当前时间格式化: new Date(currentTime).toISOString()
  });
}

// 用户登录函数 - 完整实现
async function login(data) {
  console.log('=== 🔑 login函数开始 ===');
  console.log('登录数据:', JSON.stringify(data));
  
  const { phone, password, loginType = 'phone' } = data || {};
  
  console.log('解析的登录信息:', { 
    phone, 
    loginType,
    passwordLength: password ? password.length : 0
  });
  
  // 验证必填字段
  if (!phone || !password) {
    console.log('❌ 手机号或密码为空');
    return Response.validationError('手机号和密码不能为空');
  }

  const userCollection = db.collection('user');
  let query = {};

  // 根据登录类型构建查询条件
  // 注意：根据前端代码，登录时传递的是 phone 字段，不是 username
  if (loginType === 'phone') {
    if (!Utils.validatePhone(phone)) {
      console.log('❌ 手机号格式不正确:', phone);
      return Response.validationError('手机号格式不正确');
    }
    query.phone = phone;
    console.log('📱 手机号登录，查询条件:', query);
  } else {
    // 如果不是手机号登录，可能是用户名或邮箱
    console.log('🔍 非手机号登录，尝试多种方式');
    
    // 先尝试作为手机号查询
    if (Utils.validatePhone(phone)) {
      query.phone = phone;
      console.log('📱 作为手机号查询');
    } 
    // 尝试作为邮箱查询
    else if (Utils.validateEmail(phone)) {
      query.email = phone;
      console.log('📧 作为邮箱查询');
    }
    // 否则作为用户名查询
    else {
      query.username = phone;
      console.log('👤 作为用户名查询');
    }
  }

  // 查询用户
  console.log('🔍 开始查询用户...');
  const result = await userCollection.where(query).get();
  console.log('用户查询结果:', { 
    count: result.data.length,
    data: result.data.map(u => ({ 
      id: u._id, 
      username: u.username,
      phone: u.phone 
    }))
  });
  
  if (result.data.length === 0) {
    console.log('❌ 用户不存在');
    return Response.error('用户不存在或密码错误', 404);
  }

  const user = result.data[0];
  console.log('✅ 找到用户:', { 
    id: user._id, 
    username: user.username,
    phone: user.phone,
    email: user.email,
    hasPassword: !!user.password,
    isVip: user.isVip,  // 🚨 添加调试输出
    learningDays: user.learningDays  // 🚨 添加调试输出
  });

  // 验证密码
  console.log('🔐 开始验证密码...');
  const encryptedPassword = Utils.encryptPassword(password);
  console.log('输入密码加密后:', encryptedPassword.substring(0, 10) + '...');
  console.log('数据库密码:', user.password ? user.password.substring(0, 10) + '...' : '空');
  
  // 重要：调试密码比较
  console.log('密码是否匹配:', user.password === encryptedPassword);
  console.log('数据库密码长度:', user.password ? user.password.length : 0);
  console.log('输入密码加密后长度:', encryptedPassword.length);
  
  if (user.password !== encryptedPassword) {
    console.log('❌ 密码验证失败');
    console.log('详细比较:');
    console.log('  数据库:', user.password);
    console.log('  输入的:', encryptedPassword);
    return Response.error('手机号或密码错误', 401);
  }
  console.log('✅ 密码验证成功');

  // 检查账号状态
  if (user.status && user.status !== '正常') {
    console.log('❌ 账号状态异常:', user.status);
    return Response.error(`账号${user.status}`, 403);
  }

  // 生成 token
  const token = Utils.generateToken(user._id);
  console.log('🪙 生成token:', token);
  console.log('🔍 Token详细:', {
    完整token: token,
    用户ID: user._id,
    时间戳: token.split('_')[2],
    时间戳转日期: new Date(parseInt(token.split('_')[2])).toISOString()
  });

  // 🚨 关键修复：确保数据库更新成功
  const updateData = {
    lastLoginTime: Date.now(),
    updateTime: Date.now(),
    token: token
  };
  
  console.log('📝 准备更新数据库:');
  console.log('- 用户ID:', user._id);
  console.log('- 更新数据:', updateData);
  
  try {
    // 使用 doc().update() 方法
    console.log('🔧 执行数据库更新...');
    const updateResult = await userCollection.doc(user._id).update(updateData);
    console.log('✅ 数据库更新结果:', updateResult);
    
    if (updateResult.updated === 1) {
      console.log('🎉 Token成功保存到数据库');
    } else {
      console.warn('⚠️ 数据库更新可能未生效，updated:', updateResult.updated);
    }
    
    // 🚨 验证更新是否真的生效
    console.log('🔍 验证数据库更新...');
    const verifyResult = await userCollection.doc(user._id).get();
    const updatedUser = verifyResult.data[0];
    
    if (!updatedUser) {
      console.error('❌ 验证失败：用户不存在');
    } else {
      console.log('验证结果:', {
        数据库中的token: updatedUser.token ? updatedUser.token.substring(0, 20) + '...' : '空',
        token是否匹配: updatedUser.token === token,
        最后登录时间: updatedUser.lastLoginTime,
        最后登录时间格式化: updatedUser.lastLoginTime ? new Date(updatedUser.lastLoginTime).toISOString() : '无',
        更新时间: updatedUser.updateTime
      });
      
      if (!updatedUser.token || updatedUser.token !== token) {
        console.error('❌ 严重错误：数据库未正确保存token！');
        console.log('🔄 尝试使用更直接的方法...');
        
        // 尝试使用 set 方法
        try {
          const setResult = await userCollection.doc(user._id).set({
            token: token,
            lastLoginTime: Date.now(),
            updateTime: Date.now()
          });
          console.log('直接设置结果:', setResult);
        } catch (setError) {
          console.error('直接设置失败:', setError);
        }
      }
    }
    
  } catch (updateError) {
    console.error('❌ 数据库更新失败:', updateError);
    console.log('详细错误信息:', {
      错误消息: updateError.message,
      错误代码: updateError.code,
      错误详情: updateError
    });
    
    // 🚨 尝试使用其他方法
    console.log('🔄 尝试使用其他更新方法...');
    try {
      // 尝试使用 where().update()
      const alternativeResult = await userCollection.where({
        _id: user._id
      }).update(updateData);
      console.log('替代方法结果:', alternativeResult);
    } catch (altError) {
      console.error('替代方法也失败:', altError);
    }
  }

  // 🚨 关键修复：返回完整的用户信息，包括 isVip 和 learningDays
  const userInfo = {
    _id: user._id,
    username: user.username,
    phone: user.phone,
    email: user.email || '',
    avatar: user.avatar || '/images/avatar/default.png',
    level: user.level || '初级',
    createTime: user.createTime,
    token: token,
    isVip: user.isVip || false,  // 🚨 添加 isVip 字段
    learningDays: user.learningDays || 0,  // 🚨 添加 learningDays 字段
    nickname: user.nickname || user.username,  // 🚨 添加 nickname 字段
    reportCount: user.reportCount || 0,
    likeCount: user.likeCount || 0,
    status: user.status || '正常',
    updateTime: user.updateTime,
    lastLoginTime: user.lastLoginTime
  };

  console.log('=== ✅ login函数结束，返回成功 ===');
  return Response.success({
    userInfo,
    token
  }, '登录成功');
}

// 用户注册函数
async function register(data) {
  console.log('=== 📝 register函数开始 ===');
  console.log('接收到的注册数据:', JSON.stringify(data));
  
  const { username, password, phone, email = '', level = '初级' } = data || {};
  
  console.log('解析后的字段:', { 
    username, 
    phone,
    email,
    passwordLength: password ? password.length : 0,
    level
  });
  
  // 验证必填字段
  if (!username || !password || !phone) {
    console.log('❌ 必填字段缺失:', { 
      hasUsername: !!username, 
      hasPassword: !!password, 
      hasPhone: !!phone 
    });
    return Response.validationError('用户名、密码和手机号为必填项');
  }

  // 验证密码长度
  if (password.length < 6) {
    console.log('❌ 密码长度不足:', password.length);
    return Response.validationError('密码长度不能少于6位');
  }

  const userCollection = db.collection('user');
  
  // 创建用户记录
  const userData = {
    username,
    nickname: username,  // 🚨 设置 nickname 默认值
    password: Utils.encryptPassword(password),
    phone,
    email: email || '',
    avatar: '/images/avatar/default.png',
    level: level,
    status: '正常',
    reportCount: 0,  // 🚨 添加默认值
    likeCount: 0,    // 🚨 添加默认值
    createTime: Date.now(),
    updateTime: Date.now(),
    token: '', // 初始为空
    lastLoginTime: null,
    isVip: false,  // 🚨 添加默认值
    learningDays: 0  // 🚨 添加默认值
  };

  console.log('📝 创建用户数据:', { ...userData, password: '***' });
  
  try {
    const result = await userCollection.add(userData);
    console.log('✅ 用户创建成功:', result.id);

    // 生成 token
    const token = Utils.generateToken(result.id);
    console.log('🪙 生成token:', token.substring(0, 20) + '...');

    // 返回注册结果
    const userInfo = {
      _id: result.id,
      username: userData.username,
      nickname: userData.nickname,
      phone: userData.phone,
      email: userData.email,
      avatar: userData.avatar,
      level: userData.level,
      createTime: userData.createTime,
      token: token,
      isVip: userData.isVip,  // 🚨 包含 isVip
      learningDays: userData.learningDays  // 🚨 包含 learningDays
    };

    console.log('=== ✅ register函数结束，返回成功 ===');
    return Response.success({
      userInfo,
      token
    }, '注册成功');
  } catch (error) {
    console.error('❌ 数据库操作失败:', error);
    return Response.error('注册失败，请稍后重试');
  }
}

// 🚨 获取用户信息 - 修复版本，包含所有字段
async function getUserInfo(userId) {
  console.log('=== 👤 getUserInfo函数开始 ===');
  console.log('获取用户信息，用户ID:', userId);
  
  const userCollection = db.collection('user');
  const preferenceCollection = db.collection('user-preference');

  // 获取用户基本信息
  const userResult = await userCollection.doc(userId).get();
  if (userResult.data.length === 0) {
    console.log('❌ 用户不存在');
    return Response.error('用户不存在', 404);
  }

  // 获取用户偏好
  const preferenceResult = await preferenceCollection.where({ userId }).get();
  const preference = preferenceResult.data[0] || {};

  // 🚨 关键修复：返回完整的用户信息，包含所有字段
  const user = userResult.data[0];
  const userInfo = {
    _id: user._id,
    username: user.username,
    nickname: user.nickname || user.username,  // 🚨 确保有 nickname
    phone: user.phone,
    email: user.email || '',
    avatar: user.avatar || '/images/avatar/default.png',
    level: user.level || '初级',
    status: user.status || '正常',
    createTime: user.createTime,
    updateTime: user.updateTime,
    lastLoginTime: user.lastLoginTime,
    isVip: user.isVip || false,  // 🚨 关键：包含 isVip 字段
    learningDays: user.learningDays || 0,  // 🚨 关键：包含 learningDays 字段
    reportCount: user.reportCount || 0,
    likeCount: user.likeCount || 0,
    preference: preference
  };

  console.log('📊 返回的用户信息:', {
    用户ID: userInfo._id,
    用户名: userInfo.username,
    昵称: userInfo.nickname,
    isVip: userInfo.isVip,
    learningDays: userInfo.learningDays
  });

  console.log('=== ✅ getUserInfo函数结束 ===');
  return Response.success(userInfo);
}

// 更新用户资料
async function updateProfile(userId, data) {
  console.log('=== ✏️ updateProfile函数开始 ===');
  console.log('更新用户资料:', { userId, data });
  
  const { username, email, avatar, level, nickname, isVip, learningDays } = data || {};
  const updateData = {
    updateTime: Date.now()
  };

  // 只更新提供的字段
  if (username !== undefined) {
    if (username.length < 2 || username.length > 20) {
      console.log('❌ 用户名长度无效:', username.length);
      return Response.validationError('用户名长度需在2-20个字符之间');
    }
    updateData.username = username;
  }
  
  if (email !== undefined) {
    if (email && !Utils.validateEmail(email)) {
      console.log('❌ 邮箱格式不正确:', email);
      return Response.validationError('邮箱格式不正确');
    }
    updateData.email = email;
  }
  
  if (avatar !== undefined) updateData.avatar = avatar;
  if (level !== undefined) updateData.level = level;
  if (nickname !== undefined) updateData.nickname = nickname;
  if (isVip !== undefined) updateData.isVip = isVip;
  if (learningDays !== undefined) updateData.learningDays = learningDays;

  console.log('📝 更新数据:', updateData);
  
  const userCollection = db.collection('user');
  const updateResult = await userCollection.doc(userId).update(updateData);
  
  console.log('📊 更新结果:', updateResult);

  console.log('=== ✅ updateProfile函数结束 ===');
  return Response.success(null, '资料更新成功');
}

// 修改密码
async function changePassword(userId, data) {
  console.log('=== 🔑 changePassword函数开始 ===');
  console.log('修改密码:', userId);
  
  const { oldPassword, newPassword } = data || {};

  if (!oldPassword || !newPassword) {
    console.log('❌ 旧密码或新密码为空');
    return Response.validationError('旧密码和新密码不能为空');
  }

  if (newPassword.length < 6) {
    console.log('❌ 新密码长度不足:', newPassword.length);
    return Response.validationError('新密码长度不能少于6位');
  }

  const userCollection = db.collection('user');
  const userResult = await userCollection.doc(userId).get();

  if (userResult.data.length === 0) {
    console.log('❌ 用户不存在');
    return Response.error('用户不存在', 404);
  }

  const user = userResult.data[0];

  // 验证旧密码
  const encryptedOldPassword = Utils.encryptPassword(oldPassword);
  if (user.password !== encryptedOldPassword) {
    console.log('❌ 旧密码错误');
    return Response.error('旧密码错误', 401);
  }

  // 更新密码
  const encryptedNewPassword = Utils.encryptPassword(newPassword);
  await userCollection.doc(userId).update({
    password: encryptedNewPassword,
    updateTime: Date.now()
  });

  console.log('=== ✅ changePassword函数结束 ===');
  return Response.success(null, '密码修改成功');
}

// 退出登录
async function logout(userId) {
  console.log('=== 🚪 logout函数开始 ===');
  console.log('退出登录:', userId);
  
  const userCollection = db.collection('user');
  await userCollection.doc(userId).update({
    token: '',
    updateTime: Date.now()
  });

  console.log('=== ✅ logout函数结束 ===');
  return Response.success(null, '退出成功');
}