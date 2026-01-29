// cloudfunctions/common/utils.js
'use strict';

// 加密密码（示例，实际需要使用更强的加密算法）
function encryptPassword(password) {
  // 这里应该使用 crypto 或其他加密库
  // 暂时返回简单哈希，实际开发中请使用 bcrypt 或类似的
  return password; // 实际需要替换为真正的加密
}

// 生成 token（示例）
function generateToken(userId) {
  // 实际应该使用 JWT 或其他 token 生成机制
  return 'token_' + userId + '_' + Date.now();
}

// 验证手机号格式
function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

// 验证邮箱格式
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 分页处理
function handlePagination(page = 1, pageSize = 10) {
  const skip = (page - 1) * pageSize;
  return { skip, limit: pageSize };
}

// 处理数据库返回结果
function formatResult(result) {
  if (result && result.id) {
    result._id = result.id;
    delete result.id;
  }
  return result;
}

module.exports = {
  encryptPassword,
  generateToken,
  validatePhone,
  validateEmail,
  handlePagination,
  formatResult
};