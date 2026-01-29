'use strict';
const db = uniCloud.database();

class Auth {
  // 验证用户 token
  static async verifyToken(token) {
    console.log('🔐 === TOKEN验证开始 ===');
    console.log('原始token:', token ? (typeof token === 'string' ? token.substring(0, 50) + '...' : token) : '空');
    
    if (!token) {
      console.log('❌ Token为空');
      return null;
    }

    // 去除 Bearer 前缀
    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.substring(7);
      console.log('🔧 去除Bearer前缀后:', token.substring(0, 50) + '...');
    }
    
    // 从数据库查询匹配的token
    console.log('🔍 从数据库查询token...');
    const userCollection = db.collection('user');
    let result = await userCollection.where({
      token: token
    }).get();
    
    if (result.data.length === 0) {
      console.log('❌ 数据库中没有找到匹配的token');
      return null;
    }

    const user = result.data[0];
    console.log('✅ 找到用户:', { 
      id: user._id, 
      username: user.username,
      phone: user.phone 
    });

    // 🚨 检查token是否过期（24小时过期）
    if (user.lastLoginTime) {
      const currentTime = Date.now();
      const lastLoginTime = user.lastLoginTime;
      
      // 确保lastLoginTime是数字（时间戳）
      const loginTime = typeof lastLoginTime === 'object' ? 
                       lastLoginTime.getTime() : 
                       Number(lastLoginTime);
      
      const tokenAge = currentTime - loginTime;
      const tokenExpireTime = 24 * 60 * 60 * 1000; // 24小时
      
      console.log('📅 Token时间检查:', {
        最后登录时间: loginTime,
        最后登录日期: new Date(loginTime).toISOString(),
        当前时间: currentTime,
        当前日期: new Date(currentTime).toISOString(),
        token有效期: tokenAge,
        token最大有效期: tokenExpireTime,
        是否过期: tokenAge > tokenExpireTime
      });
      
      if (tokenAge > tokenExpireTime) {
        console.log('❌ Token已过期（超过24小时）');
        
        // 🚨 自动清除过期的token
        try {
          await userCollection.doc(user._id).update({
            token: '',
            updateTime: Date.now()
          });
          console.log('✅ 已自动清除过期token');
        } catch (error) {
          console.error('清除token失败:', error);
        }
        
        return null;
      }
    } else {
      console.log('⚠️ 用户没有lastLoginTime字段');
    }

    console.log('✅ Token验证成功');
    return user;
  }

  // 中间件：验证用户登录状态
  static async middleware(event) {
    console.log('🔐 === Auth中间件开始 ===');
    console.log('请求头:', event.headers);
    
    // 获取token
    let token = event.headers?.authorization || 
                event.headers?.Authorization ||
                event.token ||
                event.uniIdToken;
    
    console.log('🔍 提取到的token:', token ? (typeof token === 'string' ? token.substring(0, 50) + '...' : token) : '空');
    
    if (!token) {
      console.log('❌ 未找到token');
      throw new Error('请先登录');
    }

    console.log('🔍 开始验证token...');
    const user = await this.verifyToken(token);
    
    if (!user) {
      console.log('❌ Token验证失败');
      throw new Error('登录已过期，请重新登录');
    }

    console.log('✅ Auth中间件验证成功，用户ID:', user._id);
    return user;
  }

  // 检查用户权限
  static checkPermission(user, requiredPermission) {
    console.log('🔐 检查用户权限:', {
      用户状态: user.status,
      要求权限: requiredPermission
    });
    
    if (user.status === '禁用') {
      throw new Error('账号已被禁用');
    }
    return true;
  }
}

module.exports = Auth;