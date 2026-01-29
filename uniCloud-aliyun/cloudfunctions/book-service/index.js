'use strict';
const db = uniCloud.database();
const $ = db.command.aggregate;
const Response = require('./common/response');
const Utils = require('./common/utils');
const Auth = require('./common/auth');

exports.main = async (event, context) => {
  console.log('🚀 云函数接收到的事件:', JSON.stringify(event, null, 2));
  
  // 解析请求体
  let requestData = {};
  let action = '';
  let data = {};
  
  if (event.body) {
    try {
      requestData = JSON.parse(event.body);
      action = requestData.action;
      data = { ...requestData };
      delete data.action;
    } catch (e) {
      console.error('❌ 解析JSON失败:', e);
      return Response.error('请求格式错误: ' + e.message, 400);
    }
  } else {
    requestData = event;
    action = requestData.action;
    data = requestData.data || {};
  }
  
  console.log('🎯 提取的action:', action);
  console.log('📋 提取的数据:', data);
  
  if (!action) {
    return Response.validationError('action参数不能为空');
  }

  try {
    // 公开接口（不需要登录）
    const publicActions = [
      'getBookList', 
      'getBookDetail', 
      'searchBooks', 
      'getHotBooks', 
      'getNewBooks',
      'getCategories',
      'getCategoryDetail',
      'searchCategories',
      'getBooksByCategory',
      'getRecommendBooks',
      'getPopularCategories',
      'test',
      'getEditorChoice',
      'getNewReleases',
      'getClassicBooks',
      'getBestsellers',
      'getTotalBookCount',
      'getCategoryBookCounts',
      'getRealTimeBookCounts',
      'getAllCategories'  // ✅ 新增：获取所有分类
    ];
    
    // 需要登录的接口
    if (!publicActions.includes(action)) {
      const user = await Auth.middleware(event);
      if (!user) {
        return Response.unauthorized('请先登录');
      }
      event.user = user;
    }

    // 路由到对应的处理函数
    console.log(`🔄 处理action: ${action}`);
    
    switch (action) {
      case 'test':
        return await testConnection(data);
      
      // ✅ 新增：获取所有分类（用于搜索页面）
      case 'getAllCategories':
        return await getAllCategories(data);
      
      // 书籍数量统计相关接口
      case 'getTotalBookCount':
        return await getTotalBookCount(data);
      case 'getCategoryBookCounts':
        return await getCategoryBookCounts(data);
      case 'getRealTimeBookCounts':
        return await getRealTimeBookCounts(data);
      
      // 书籍相关
      case 'getHotBooks':
        return await getHotBooks(data);
      case 'getBookList':
        return await getBookList(data);
      case 'getBookDetail':
        return await getBookDetail(data);
      case 'searchBooks':
        return await searchBooks(data);
      case 'getNewBooks':
        return await getNewBooks(data);
      case 'getBooksByCategory':
        return await getBooksByCategory(data);
      case 'getRecommendBooks':
        return await getRecommendBooks(data);
      
      // 推荐相关
      case 'getEditorChoice':
        return await getEditorChoice(data);
      case 'getNewReleases':
        return await getNewReleases(data);
      case 'getClassicBooks':
        return await getClassicBooks(data);
      case 'getBestsellers':
        return await getBestsellers(data);
      
      // 分类相关
      case 'getCategories':
        return await getCategories(data);
      case 'getCategoryDetail':
        return await getCategoryDetail(data);
      case 'searchCategories':
        return await searchCategories(data);
      case 'getPopularCategories':
        return await getPopularCategories(data);
      
      // 用户操作（需要登录）
      case 'addBook':
        return await addBook(data);
      case 'updateBook':
        return await updateBook(data);
      case 'deleteBook':
        return await deleteBook(data);
      case 'likeBook':
        return await likeBook(event.user?._id, data);
      case 'cancelLikeBook':
        return await cancelLikeBook(event.user?._id, data);
		
      case 'getUserProfileData':
        return await getUserProfileData(data);
          
      case 'getStudyStats':
        return await getUserStudyStats(data);
          
      case 'getBookStats':
        return await getUserBookStats(data);
		  
	    // ✅ 新增：用户收藏相关API
	    case 'addToFavorites':
	      return await addToFavorites(event.user?._id, data);
	    case 'removeFromFavorites':
	      return await removeFromFavorites(event.user?._id, data);
	    case 'checkFavorite':
	      return await checkFavorite(event.user?._id, data);
	    case 'getMyFavorites':
	      return await getMyFavorites(event.user?._id, data);
	      
	    // ✅ 新增：用户下载相关API
	    case 'recordDownload':
	      return await recordDownload(event.user?._id, data);
	    case 'getMyDownloads':
	      return await getMyDownloads(event.user?._id, data);
	      
	    // ✅ 新增：用户完成相关API
	    case 'markAsCompleted':
	      return await markAsCompleted(event.user?._id, data);
	    case 'getMyCompleted':
	      return await getMyCompleted(event.user?._id, data);
	      
	    // ✅ 新增：用户进行中相关API
	    case 'getMyInProgress':
	      return await getMyInProgress(event.user?._id, data);
	      
	    // ✅ 新增：获取用户所有书籍统计
	    case 'getMyAllBookStats':
	      return await getMyAllBookStats(event.user?._id, data);
		  
      default:
        console.warn(`⚠️ 未知的action: ${action}`);
        return Response.validationError(`未知的操作类型: ${action}`);
    }
  } catch (error) {
    console.error('❌ 书籍服务错误:', error);
    return Response.error(error.message || '服务器内部错误', 500);
  }
};

// ==================== 工具函数 ====================
function handlePagination(page = 1, pageSize = 10) {
  const skip = (page - 1) * pageSize;
  const limit = parseInt(pageSize);
  return { skip, limit };
}

// ==================== 核心功能函数 ====================

// ✅ 新增：获取所有分类（树形结构）
async function getAllCategories(data) {
  console.log('🌳 获取所有分类（树形结构）');
  
  const categoryCollection = db.collection('book-category');
  const bookCollection = db.collection('book-info');
  
  try {
    // 获取所有分类
    const categoriesResult = await categoryCollection
      .where({
        status: 1
      })
      .field({
        _id: true,
        name: true,
        enName: true,
        icon: true,
        parentId: true,
        description: true,
        categoryColor: true,
        difficulty: true,
        isHot: true,
        isRecommend: true,
        sort: true
      })
      .orderBy('sort', 'asc')
      .get();
    
    let categories = categoriesResult.data;
    console.log(`✅ 获取到 ${categories.length} 个分类`);
    
    if (categories.length === 0) {
      return Response.success({
        list: [],
        flatList: []
      });
    }
    
    // ✅ 修复：处理书籍数量统计
    // 获取所有分类ID（字符串）
    const categoryIds = categories.map(cat => cat._id);
    
    // 创建一个映射来存储每个分类的书籍数量
    const bookCountMap = {};
    
    if (categoryIds.length > 0) {
      try {
        // 方法1：使用聚合查询统计每个分类的书籍数量
        const countResult = await bookCollection
          .aggregate()
          .match({
            status: '完结'
          })
          .group({
            _id: '$categoryId',
            count: $.sum(1)
          })
          .end();
        
        if (countResult.data && countResult.data.length > 0) {
          countResult.data.forEach(item => {
            // ✅ 关键修复：将数字类型的categoryId转换为字符串进行匹配
            bookCountMap[item._id.toString()] = item.count;
          });
        }
        
        console.log('📊 书籍统计结果:', bookCountMap);
      } catch (error) {
        console.warn('使用聚合查询统计失败，尝试替代方案:', error);
        
        // 方法2：逐个分类查询（作为备选方案）
        for (const categoryId of categoryIds) {
          try {
            // ✅ 关键修复：处理数字和字符串类型的匹配
            const queryCategoryId = parseInt(categoryId);
            const finalQueryId = isNaN(queryCategoryId) ? categoryId : queryCategoryId;
            
            const countResult = await bookCollection
              .where({
                categoryId: finalQueryId,
                status: '完结'
              })
              .count();
            
            bookCountMap[categoryId] = countResult.total;
          } catch (subError) {
            console.error(`统计分类 ${categoryId} 失败:`, subError);
            bookCountMap[categoryId] = 0;
          }
        }
      }
    }
    
    // 构建树形结构
    const treeMap = {};
    const rootCategories = [];
    
    // 首先将所有分类放入映射
    categories.forEach(category => {
      const categoryId = category._id;
      treeMap[categoryId] = {
        ...category,
        bookCount: bookCountMap[categoryId] || 0,
        children: []
      };
    });
    
    // 构建树形结构
    categories.forEach(category => {
      const node = treeMap[category._id];
      const parentId = category.parentId;
      
      if (parentId && treeMap[parentId]) {
        // 有父分类，添加到父分类的children中
        treeMap[parentId].children.push(node);
      } else {
        // 没有父分类或父分类不存在，作为根分类
        rootCategories.push(node);
      }
    });
    
    // 按排序字段排序
    rootCategories.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    rootCategories.forEach(category => {
      if (category.children && category.children.length > 0) {
        category.children.sort((a, b) => (a.sort || 0) - (b.sort || 0));
      }
    });
    
    // 创建扁平化列表（用于前端直接查找）
    const flatList = categories.map(category => ({
      _id: category._id,
      id: category._id,
      name: category.name,
      enName: category.enName,
      icon: category.icon,
      parentId: category.parentId,
      description: category.description,
      categoryColor: category.categoryColor,
      difficulty: category.difficulty,
      isHot: category.isHot,
      isRecommend: category.isRecommend,
      sort: category.sort,
      bookCount: bookCountMap[category._id] || 0
    }));
    
    return Response.success({
      list: rootCategories,  // 树形结构
      flatList: flatList     // 扁平结构
    }, '获取所有分类成功');
    
  } catch (error) {
    console.error('获取所有分类失败:', error);
    return Response.error('获取所有分类失败: ' + error.message, 500);
  }
}

// 测试连接接口
async function testConnection(data) {
  console.log('✅ 处理测试连接请求');
  return Response.success({
    timestamp: Date.now(),
    version: '1.0.0',
    message: data.message || '云函数连接成功',
    requestData: data,
    serverTime: new Date().toISOString(),
    status: 'connected'
  }, '云函数连接测试成功');
}

// 获取所有书籍总数
async function getTotalBookCount(data) {
  console.log('📊 获取所有书籍总数');
  
  const bookCollection = db.collection('book-info');
  
  try {
    const countResult = await bookCollection
      .where({
        status: '完结'
      })
      .count();
    
    return Response.success({
      totalBooks: countResult.total,
      timestamp: Date.now()
    }, '获取书籍总数成功');
  } catch (error) {
    console.error('获取书籍总数失败:', error);
    return Response.error('获取书籍总数失败: ' + error.message, 500);
  }
}

// 批量获取分类书籍数量
async function getCategoryBookCounts(data) {
  const { categoryIds } = data;
  
  if (!categoryIds || !Array.isArray(categoryIds)) {
    return Response.validationError('分类ID列表不能为空');
  }
  
  const bookCollection = db.collection('book-info');
  
  try {
    // ✅ 修复：处理混合类型（字符串和数字）
    const counts = {};
    
    for (const categoryId of categoryIds) {
      try {
        // 尝试将字符串ID转换为数字进行查询
        const numId = parseInt(categoryId);
        const queryId = isNaN(numId) ? categoryId : numId;
        
        const countResult = await bookCollection
          .where({
            categoryId: queryId,
            status: '完结'
          })
          .count();
        
        counts[categoryId] = countResult.total;
      } catch (error) {
        console.error(`统计分类 ${categoryId} 失败:`, error);
        counts[categoryId] = 0;
      }
    }
    
    return Response.success({
      counts: counts,
      totalCategories: categoryIds.length,
      timestamp: Date.now()
    }, '获取分类书籍数量成功');
  } catch (error) {
    console.error('获取分类书籍数量失败:', error);
    return Response.error('获取分类书籍数量失败: ' + error.message, 500);
  }
}

// 实时获取所有分类书籍数量
async function getRealTimeBookCounts(data) {
  console.log('📊 获取实时书籍数量');
  const { withCategories = true } = data;
  
  const categoryCollection = db.collection('book-category');
  const bookCollection = db.collection('book-info');
  
  try {
    // 获取所有分类
    const categoriesResult = await categoryCollection
      .where({
        parentId: '',
        status: 1
      })
      .field({
        _id: true,
        name: true,
        enName: true,
        icon: true,
        bgImage: true,
        description: true,
        difficulty: true,
        isHot: true,
        isRecommend: true,
        sort: true,
        createTime: true
      })
      .orderBy('sort', 'asc')
      .get();
    
    const categories = categoriesResult.data;
    console.log(`📊 获取到 ${categories.length} 个分类`);
    
    // ✅ 修复：逐个统计每个分类的书籍数量
    const categoriesWithCounts = [];
    
    for (const category of categories) {
      const categoryId = category._id;
      
      // 尝试将字符串ID转换为数字进行查询
      const numId = parseInt(categoryId);
      const queryId = isNaN(numId) ? categoryId : numId;
      
      try {
        const bookCountResult = await bookCollection
          .where({
            categoryId: queryId,
            status: '完结'
          })
          .count();
        
        categoriesWithCounts.push({
          ...category,
          bookCount: bookCountResult.total
        });
      } catch (error) {
        console.error(`统计分类 ${category.name} 失败:`, error);
        categoriesWithCounts.push({
          ...category,
          bookCount: 0
        });
      }
    }
    
    // 计算总书籍数量
    const totalBooks = categoriesWithCounts.reduce((sum, category) => sum + category.bookCount, 0);
    
    console.log(`📊 总书籍数量: ${totalBooks}`);
    
    return Response.success({
      categories: categoriesWithCounts,
      totalBooks: totalBooks,
      categoryCount: categories.length,
      timestamp: Date.now()
    }, '获取实时书籍数量成功');
  } catch (error) {
    console.error('获取实时书籍数量失败:', error);
    return Response.error('获取实时书籍数量失败: ' + error.message, 500);
  }
}

// ✅ 修复：搜索书籍（增强版，解决分类显示问题）
async function searchBooks(data) {
  const { keyword, page = 1, pageSize = 10 } = data;

  if (!keyword || keyword.trim() === '') {
    return Response.validationError('搜索关键词不能为空');
  }

  const { skip, limit } = handlePagination(page, pageSize);
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');

  try {
    // 构建搜索条件
    const searchRegex = new RegExp(keyword, 'i');
    const query = bookCollection.where(
      db.command.or([
        { title: searchRegex },
        { author: searchRegex },
        { description: searchRegex }
      ])
    ).where({
      status: '完结'
    });

    // 执行查询
    const [booksResult, totalResult] = await Promise.all([
      query
        .field({
          _id: true,
          title: true,
          subtitle: true,
          author: true,
          cover: true,
          description: true,
          level: true,
          totalChapters: true,
          totalDuration: true,
          likeCount: true,
          popularity: true,
          isRecommend: true,
          recommendWeight: true,
          recommendBadge: true,
          recommendReason: true,
          recommendOrder: true,
          createTime: true,
          categoryId: true
        })
        .orderBy('popularity', 'desc')
        .skip(skip)
        .limit(limit)
        .get(),
      query.count()
    ]);

    const books = booksResult.data;
    
    if (books.length === 0) {
      return Response.success({
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      });
    }

    // ✅ 修复：获取分类信息（解决类型不匹配问题）
    // 提取所有不重复的categoryId
    const categoryIds = [...new Set(books.map(book => book.categoryId).filter(id => id))];
    let categoriesMap = {};
    
    if (categoryIds.length > 0) {
      try {
        // 方法1：先尝试查询字符串类型的分类ID
        const categoriesResult = await categoryCollection
          .where({
            _id: db.command.in(categoryIds)
          })
          .field({
            _id: true,
            name: true,
            icon: true,
            categoryColor: true,
            parentId: true
          })
          .get();
        
        // 创建映射
        categoriesResult.data.forEach(cat => {
          categoriesMap[cat._id] = cat;
        });
        
        // ✅ 方法2：如果还有未找到的分类，尝试将数字ID转换为字符串查询
        const missingIds = categoryIds.filter(id => !categoriesMap[id]);
        
        if (missingIds.length > 0) {
          console.log('尝试查找缺失的分类ID:', missingIds);
          
          for (const missingId of missingIds) {
            try {
              // 尝试将数字ID转换为字符串查询
              const categoryResult = await categoryCollection
                .where({
                  name: new RegExp(`^${missingId}$`, 'i') // 尝试按名称匹配
                })
                .field({
                  _id: true,
                  name: true,
                  icon: true,
                  categoryColor: true,
                  parentId: true
                })
                .get();
              
              if (categoryResult.data.length > 0) {
                categoriesMap[missingId] = categoryResult.data[0];
                console.log(`✅ 找到对应分类: ${missingId} -> ${categoryResult.data[0].name}`);
              }
            } catch (subError) {
              console.warn(`查找分类 ${missingId} 失败:`, subError);
            }
          }
        }
      } catch (error) {
        console.error('批量查询分类失败:', error);
      }
    }
    
    // 将分类信息附加到书籍数据
    const booksWithCategories = books.map(book => {
      const categoryId = book.categoryId;
      let categoryInfo = categoriesMap[categoryId];
      
      // 如果找不到分类信息，使用默认值
      if (!categoryInfo) {
        categoryInfo = {
          name: '未分类',
          icon: '📚',
          categoryColor: '#1890ff',
          parentId: ''
        };
        
        // 尝试根据ID查找默认分类
        if (categoryId) {
          // 数字ID对应的默认分类名称
          const defaultCategoryMap = {
            '1': '文学',
            '2': '历史', 
            '3': '科学',
            '4': '教育',
            '5': '财经',
            '6': '语言',
            '7': '经典',
            '8': '儿童'
          };
          
          const defaultName = defaultCategoryMap[categoryId.toString()];
          if (defaultName) {
            categoryInfo.name = defaultName;
          }
        }
      }
      
      return {
        ...book,
        categoryName: categoryInfo.name,
        categoryIcon: categoryInfo.icon,
        categoryColor: categoryInfo.categoryColor,
        parentId: categoryInfo.parentId
      };
    });

    return Response.success({
      list: booksWithCategories,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    }, '搜索成功');
    
  } catch (error) {
    console.error('搜索书籍失败:', error);
    return Response.error('搜索书籍失败: ' + error.message, 500);
  }
}

// 获取分类列表
async function getCategories(data) {
  console.log('📂 获取分类列表');
  const { 
    page = 1, 
    pageSize = 20, 
    sortBy = 'sort', 
    order = 'asc',
    withBookCount = true,
    onlyHot = false,
    onlyRecommend = false
  } = data;
  
  const { skip, limit } = handlePagination(page, pageSize);
  const categoryCollection = db.collection('book-category');
  const bookCollection = db.collection('book-info');

  try {
    // 构建查询条件
    let query = categoryCollection.where({
      parentId: '',
      status: 1
    });

    // 筛选条件
    if (onlyHot) {
      query = query.where({ isHot: true });
    }

    if (onlyRecommend) {
      query = query.where({ isRecommend: true });
    }

    // 排序
    const sortOrder = order === 'desc' ? 'desc' : 'asc';

    // 执行查询
    const [categoriesResult, totalResult] = await Promise.all([
      query
        .field({
          _id: true,
          name: true,
          enName: true,
          icon: true,
          bgImage: true,
          description: true,
          gradient: true,
          categoryColor: true,
          difficulty: true,
          isHot: true,
          isRecommend: true,
          sort: true,
          createTime: true
        })
        .orderBy(sortBy, sortOrder)
        .skip(skip)
        .limit(limit)
        .get(),
      query.count()
    ]);

    let categories = categoriesResult.data;
    console.log(`✅ 获取到 ${categories.length} 个分类`);

    // 如果需要实时书籍数量
    if (withBookCount && categories.length > 0) {
      const categoriesWithCounts = [];
      
      for (const category of categories) {
        const categoryId = category._id;
        
        // ✅ 修复：处理数字和字符串类型转换
        const numId = parseInt(categoryId);
        const queryId = isNaN(numId) ? categoryId : numId;
        
        try {
          const bookCountResult = await bookCollection
            .where({
              categoryId: queryId,
              status: '完结'
            })
            .count();
          
          categoriesWithCounts.push({
            ...category,
            bookCount: bookCountResult.total
          });
        } catch (error) {
          console.error(`统计分类 ${category.name} 失败:`, error);
          categoriesWithCounts.push({
            ...category,
            bookCount: 0
          });
        }
      }
      
      categories = categoriesWithCounts;
    }

    return Response.success({
      list: categories,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      },
      withRealTimeCount: withBookCount
    });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    return Response.error('获取分类列表失败: ' + error.message, 500);
  }
}

// 获取分类详情
async function getCategoryDetail(data) {
  const { categoryId } = data;

  if (!categoryId) {
    return Response.validationError('分类ID不能为空');
  }

  const categoryCollection = db.collection('book-category');
  const bookCollection = db.collection('book-info');

  try {
    // 获取分类信息
    const categoryResult = await categoryCollection.doc(categoryId).get();
    if (categoryResult.data.length === 0) {
      return Response.notFound('分类不存在');
    }

    const category = categoryResult.data[0];

    // ✅ 修复：处理数字和字符串类型转换
    const queryCategoryId = parseInt(categoryId);
    const finalCategoryId = isNaN(queryCategoryId) ? categoryId : queryCategoryId;

    console.log(`📊 查询分类详情，分类ID: ${categoryId}, 查询ID: ${finalCategoryId}`);

    // 获取分类下的热门书籍
    const hotBooksResult = await bookCollection
      .where({
        categoryId: finalCategoryId,
        status: '完结'
      })
      .orderBy('popularity', 'desc')
      .limit(6)
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        description: true,
        level: true,
        totalChapters: true,
        likeCount: true,
        popularity: true,
        recommendBadge: true
      })
      .get();

    // 实时统计该分类的书籍数量
    const bookCountResult = await bookCollection.where({
      categoryId: finalCategoryId,
      status: '完结'
    }).count();

    console.log(`📊 分类 ${category.name} 有 ${bookCountResult.total} 本书`);

    // 获取子分类（如果存在）
    const subCategoriesResult = await categoryCollection
      .where({
        parentId: categoryId,
        status: 1
      })
      .orderBy('sort', 'asc')
      .get();

    // ✅ 修复：为子分类统计书籍数量
    let subCategories = subCategoriesResult.data || [];
    if (subCategories.length > 0) {
      const subCategoriesWithCounts = [];
      
      for (const subCategory of subCategories) {
        const subCategoryId = subCategory._id;
        const numId = parseInt(subCategoryId);
        const queryId = isNaN(numId) ? subCategoryId : numId;
        
        try {
          const subBookCountResult = await bookCollection
            .where({
              categoryId: queryId,
              status: '完结'
            })
            .count();
          
          subCategoriesWithCounts.push({
            ...subCategory,
            bookCount: subBookCountResult.total
          });
        } catch (error) {
          console.error(`统计子分类 ${subCategory.name} 失败:`, error);
          subCategoriesWithCounts.push({
            ...subCategory,
            bookCount: 0
          });
        }
      }
      
      subCategories = subCategoriesWithCounts;
    }

    return Response.success({
      ...category,
      bookCount: bookCountResult.total,
      hotBooks: hotBooksResult.data,
      subCategories: subCategories
    });
  } catch (error) {
    console.error('获取分类详情失败:', error);
    return Response.error('获取分类详情失败: ' + error.message, 500);
  }
}

// 搜索分类
async function searchCategories(data) {
  const { keyword, page = 1, pageSize = 20 } = data;

  if (!keyword || keyword.trim() === '') {
    return Response.validationError('搜索关键词不能为空');
  }

  const { skip, limit } = handlePagination(page, pageSize);
  const categoryCollection = db.collection('book-category');
  const bookCollection = db.collection('book-info');

  try {
    // 构建搜索条件
    const query = categoryCollection.where(
      db.command.or([
        { name: new RegExp(keyword, 'i') },
        { enName: new RegExp(keyword, 'i') },
        { description: new RegExp(keyword, 'i') }
      ])
    ).where({
      parentId: '',
      status: 1
    });

    const [categoriesResult, totalResult] = await Promise.all([
      query
        .field({
          _id: true,
          name: true,
          enName: true,
          icon: true,
          bgImage: true,
          description: true,
          gradient: true,
          categoryColor: true,
          difficulty: true,
          isHot: true,
          isRecommend: true,
          sort: true
        })
        .orderBy('sort', 'asc')
        .skip(skip)
        .limit(limit)
        .get(),
      query.count()
    ]);

    let categories = categoriesResult.data;

    // ✅ 实时统计书籍数量
    if (categories.length > 0) {
      const categoriesWithCounts = [];
      
      for (const category of categories) {
        const categoryId = category._id;
        const numId = parseInt(categoryId);
        const queryId = isNaN(numId) ? categoryId : numId;
        
        try {
          const bookCountResult = await bookCollection
            .where({
              categoryId: queryId,
              status: '完结'
            })
            .count();
          
          categoriesWithCounts.push({
            ...category,
            bookCount: bookCountResult.total
          });
        } catch (error) {
          console.error(`统计分类 ${category.name} 失败:`, error);
          categoriesWithCounts.push({
            ...category,
            bookCount: 0
          });
        }
      }
      
      categories = categoriesWithCounts;
    }

    return Response.success({
      list: categories,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    });
  } catch (error) {
    console.error('搜索分类失败:', error);
    return Response.error('搜索分类失败: ' + error.message, 500);
  }
}

// 获取热门分类
async function getPopularCategories(data) {
  const { limit = 8 } = data;
  const categoryCollection = db.collection('book-category');
  const bookCollection = db.collection('book-info');

  try {
    // 获取热门或推荐分类
    const categoriesResult = await categoryCollection
      .where({
        parentId: '',
        status: 1,
        $or: [
          { isHot: true },
          { isRecommend: true }
        ]
      })
      .orderBy('sort', 'asc')
      .limit(limit)
      .field({
        _id: true,
        name: true,
        enName: true,
        icon: true,
        bgImage: true,
        description: true,
        gradient: true,
        categoryColor: true,
        difficulty: true,
        isHot: true,
        isRecommend: true
      })
      .get();

    let categories = categoriesResult.data;

    // ✅ 实时统计书籍数量
    if (categories.length > 0) {
      const categoriesWithCounts = [];
      
      for (const category of categories) {
        const categoryId = category._id;
        const numId = parseInt(categoryId);
        const queryId = isNaN(numId) ? categoryId : numId;
        
        try {
          const bookCountResult = await bookCollection
            .where({
              categoryId: queryId,
              status: '完结'
            })
            .count();
          
          categoriesWithCounts.push({
            ...category,
            bookCount: bookCountResult.total
          });
        } catch (error) {
          console.error(`统计分类 ${category.name} 失败:`, error);
          categoriesWithCounts.push({
            ...category,
            bookCount: 0
          });
        }
      }
      
      categories = categoriesWithCounts;
    }

    return Response.success(categories);
  } catch (error) {
    console.error('获取热门分类失败:', error);
    return Response.error('获取热门分类失败: ' + error.message, 500);
  }
}

// 获取书籍列表（带分页和筛选）
async function getBookList(data) {
  console.log('📖 获取书籍列表');
  const { 
    page = 1, 
    pageSize = 10, 
    categoryId, 
    level, 
    status,
    sortBy = 'createTime',
    order = 'desc'
  } = data;

  const { skip, limit } = handlePagination(page, pageSize);
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');

  try {
    let query = bookCollection.where({
      status: '完结'
    });

    if (categoryId) {
      // ✅ 处理数字和字符串类型转换
      const queryCategoryId = parseInt(categoryId);
      const finalCategoryId = isNaN(queryCategoryId) ? categoryId : queryCategoryId;
      query = query.where({ categoryId: finalCategoryId });
    }

    if (level) {
      query = query.where({ level });
    }

    // 排序
    const sortOrder = order === 'desc' ? 'desc' : 'asc';

    const [booksResult, totalResult] = await Promise.all([
      query
        .field({
          _id: true,
          title: true,
          author: true,
          cover: true,
          description: true,
          level: true,
          totalChapters: true,
          totalDuration: true,
          likeCount: true,
          commentCount: true,
          popularity: true,
          createTime: true,
          recommendBadge: true,
          isRecommend: true,
          categoryId: true
        })
        .orderBy(sortBy, sortOrder)
        .skip(skip)
        .limit(limit)
        .get(),
      query.count()
    ]);

    // ✅ 获取分类信息（修复类型不匹配）
    const books = booksResult.data;
    const categoriesMap = {};
    
    if (books.length > 0) {
      const uniqueCategoryIds = [...new Set(books.map(book => book.categoryId).filter(id => id))];
      
      if (uniqueCategoryIds.length > 0) {
        // 尝试查找分类信息
        for (const catId of uniqueCategoryIds) {
          try {
            // 先尝试按字符串ID查找
            const categoryResult = await categoryCollection.doc(catId).get();
            if (categoryResult.data.length > 0) {
              categoriesMap[catId] = categoryResult.data[0];
            } else {
              // 尝试按名称查找（作为备选）
              const fallbackResult = await categoryCollection
                .where({
                  name: new RegExp(`^${catId}$`, 'i')
                })
                .limit(1)
                .get();
              
              if (fallbackResult.data.length > 0) {
                categoriesMap[catId] = fallbackResult.data[0];
              }
            }
          } catch (error) {
            console.error(`查找分类 ${catId} 失败:`, error);
          }
        }
      }
    }

    // 组合数据
    const booksWithCategories = books.map(book => {
      const categoryInfo = categoriesMap[book.categoryId];
      return {
        ...book,
        categoryName: categoryInfo ? categoryInfo.name : '未分类',
        categoryIcon: categoryInfo ? categoryInfo.icon : '📚',
        categoryColor: categoryInfo ? categoryInfo.categoryColor : '#1890ff'
      };
    });

    return Response.success({
      list: booksWithCategories,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取书籍列表失败:', error);
    return Response.error('获取书籍列表失败: ' + error.message, 500);
  }
}

// 根据分类获取书籍
async function getBooksByCategory(data) {
  const { categoryId, page = 1, pageSize = 10 } = data;

  if (!categoryId) {
    return Response.validationError('分类ID不能为空');
  }

  const { skip, limit } = handlePagination(page, pageSize);
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');

  try {
    // 获取分类信息
    const categoryResult = await categoryCollection.doc(categoryId).get();
    if (categoryResult.data.length === 0) {
      return Response.notFound('分类不存在');
    }

    const category = categoryResult.data[0];

    // ✅ 处理数字和字符串类型转换
    const queryCategoryId = parseInt(categoryId);
    const finalCategoryId = isNaN(queryCategoryId) ? categoryId : queryCategoryId;

    console.log(`📊 查询分类 ${category.name} 的书籍，查询ID: ${finalCategoryId}`);

    const [booksResult, totalResult] = await Promise.all([
      bookCollection
        .where({ 
          categoryId: finalCategoryId,
          status: '完结'
        })
        .orderBy('popularity', 'desc')
        .skip(skip)
        .limit(limit)
        .field({
          _id: true,
          title: true,
          author: true,
          cover: true,
          level: true,
          totalChapters: true,
          totalDuration: true,
          likeCount: true,
          recommendBadge: true,
          isRecommend: true
        })
        .get(),
      bookCollection.where({ 
        categoryId: finalCategoryId,
        status: '完结'
      }).count()
    ]);

    return Response.success({
      list: booksResult.data,
      categoryInfo: {
        name: category.name,
        enName: category.enName,
        description: category.description
      },
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    });
  } catch (error) {
    console.error('根据分类获取书籍失败:', error);
    return Response.error('根据分类获取书籍失败: ' + error.message, 500);
  }
}

// 获取推荐书籍
async function getRecommendBooks(data) {
  console.log('⭐ 获取推荐书籍');
  const { limit = 10, recommendType, page = 1, pageSize = 10 } = data;
  const { skip, limit: queryLimit } = handlePagination(page, pageSize);
  
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');
  
  try {
    let query = bookCollection.where({
      isRecommend: true,
      status: '完结'
    });
    
    if (recommendType) {
      query = query.where({
        recommendType: db.command.in([recommendType])
      });
    }
    
    const [booksResult, totalResult] = await Promise.all([
      query
        .orderBy('recommendWeight', 'desc')
        .orderBy('recommendOrder', 'asc')
        .orderBy('popularity', 'desc')
        .skip(skip)
        .limit(queryLimit)
        .field({
          _id: true,
          title: true,
          author: true,
          cover: true,
          description: true,
          level: true,
          totalChapters: true,
          likeCount: true,
          popularity: true,
          recommendReason: true,
          recommendBadge: true,
          recommendType: true,
          isRecommend: true,
          categoryId: true
        })
        .get(),
      query.count()
    ]);
    
    // ✅ 获取分类信息
    const books = booksResult.data;
    const categoriesMap = {};
    
    if (books.length > 0) {
      const uniqueCategoryIds = [...new Set(books.map(book => book.categoryId).filter(id => id))];
      
      if (uniqueCategoryIds.length > 0) {
        for (const catId of uniqueCategoryIds) {
          try {
            const categoryResult = await categoryCollection.doc(catId).get();
            if (categoryResult.data.length > 0) {
              categoriesMap[catId] = categoryResult.data[0];
            }
          } catch (error) {
            console.error(`查找分类 ${catId} 失败:`, error);
          }
        }
      }
    }
    
    // 组合数据
    const booksWithCategories = books.map(book => {
      const categoryInfo = categoriesMap[book.categoryId];
      return {
        ...book,
        categoryName: categoryInfo ? categoryInfo.name : '未分类',
        categoryIcon: categoryInfo ? categoryInfo.icon : '📚',
        categoryColor: categoryInfo ? categoryInfo.categoryColor : '#1890ff'
      };
    });
    
    console.log(`✅ 获取到 ${booksResult.data.length} 本推荐书籍`);
    
    return Response.success({
      list: booksWithCategories,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取推荐书籍失败:', error);
    return Response.error('获取推荐书籍失败: ' + error.message, 500);
  }
}

// 获取热门书籍
async function getHotBooks(data) {
  console.log('📚 获取热门书籍');
  const { limit = 10 } = data;
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');

  try {
    const result = await bookCollection
      .where({
        status: '完结'
      })
      .orderBy('popularity', 'desc')
      .limit(limit)
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        level: true,
        popularity: true,
        totalChapters: true,
        likeCount: true,
        recommendBadge: true,
        categoryId: true
      })
      .get();
    
    // ✅ 获取分类信息
    const books = result.data;
    const categoriesMap = {};
    
    if (books.length > 0) {
      const uniqueCategoryIds = [...new Set(books.map(book => book.categoryId).filter(id => id))];
      
      if (uniqueCategoryIds.length > 0) {
        for (const catId of uniqueCategoryIds) {
          try {
            const categoryResult = await categoryCollection.doc(catId).get();
            if (categoryResult.data.length > 0) {
              categoriesMap[catId] = categoryResult.data[0];
            }
          } catch (error) {
            console.error(`查找分类 ${catId} 失败:`, error);
          }
        }
      }
    }
    
    // 组合数据
    const booksWithCategories = books.map(book => {
      const categoryInfo = categoriesMap[book.categoryId];
      return {
        ...book,
        categoryName: categoryInfo ? categoryInfo.name : '未分类',
        categoryIcon: categoryInfo ? categoryInfo.icon : '📚',
        categoryColor: categoryInfo ? categoryInfo.categoryColor : '#1890ff'
      };
    });
    
    console.log(`✅ 获取到 ${result.data.length} 本热门书籍`);
    return Response.success(booksWithCategories);
  } catch (error) {
    console.error('获取热门书籍失败:', error);
    return Response.error('获取热门书籍失败: ' + error.message, 500);
  }
}

// 获取编辑精选
async function getEditorChoice(data) {
  console.log('🏆 获取编辑精选');
  const { limit = 10 } = data;
  
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');
  
  try {
    const result = await bookCollection
      .where({
        isRecommend: true,
        recommendType: db.command.in(['editor_choice']),
        status: '完结'
      })
      .orderBy('recommendWeight', 'desc')
      .orderBy('popularity', 'desc')
      .limit(limit)
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        description: true,
        level: true,
        totalChapters: true,
        likeCount: true,
        popularity: true,
        recommendReason: true,
        recommendBadge: true,
        categoryId: true
      })
      .get();
    
    // ✅ 获取分类信息
    const books = result.data;
    const categoriesMap = {};
    
    if (books.length > 0) {
      const uniqueCategoryIds = [...new Set(books.map(book => book.categoryId).filter(id => id))];
      
      if (uniqueCategoryIds.length > 0) {
        for (const catId of uniqueCategoryIds) {
          try {
            const categoryResult = await categoryCollection.doc(catId).get();
            if (categoryResult.data.length > 0) {
              categoriesMap[catId] = categoryResult.data[0];
            }
          } catch (error) {
            console.error(`查找分类 ${catId} 失败:`, error);
          }
        }
      }
    }
    
    // 组合数据
    const booksWithCategories = books.map(book => {
      const categoryInfo = categoriesMap[book.categoryId];
      return {
        ...book,
        categoryName: categoryInfo ? categoryInfo.name : '未分类',
        categoryIcon: categoryInfo ? categoryInfo.icon : '📚',
        categoryColor: categoryInfo ? categoryInfo.categoryColor : '#1890ff'
      };
    });
    
    console.log(`✅ 获取到 ${result.data.length} 本编辑精选书籍`);
    return Response.success(booksWithCategories);
  } catch (error) {
    console.error('获取编辑精选失败:', error);
    return Response.error('获取编辑精选失败: ' + error.message, 500);
  }
}

// 获取新书推荐
async function getNewReleases(data) {
  console.log('🆕 获取新书推荐');
  const { limit = 10 } = data;
  
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');
  
  try {
    const result = await bookCollection
      .where({
        isRecommend: true,
        recommendType: db.command.in(['new_release']),
        status: '完结'
      })
      .orderBy('recommendOrder', 'asc')
      .orderBy('createTime', 'desc')
      .limit(limit)
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        description: true,
        level: true,
        totalChapters: true,
        likeCount: true,
        createTime: true,
        recommendBadge: true,
        categoryId: true
      })
      .get();
    
    // ✅ 获取分类信息
    const books = result.data;
    const categoriesMap = {};
    
    if (books.length > 0) {
      const uniqueCategoryIds = [...new Set(books.map(book => book.categoryId).filter(id => id))];
      
      if (uniqueCategoryIds.length > 0) {
        for (const catId of uniqueCategoryIds) {
          try {
            const categoryResult = await categoryCollection.doc(catId).get();
            if (categoryResult.data.length > 0) {
              categoriesMap[catId] = categoryResult.data[0];
            }
          } catch (error) {
            console.error(`查找分类 ${catId} 失败:`, error);
          }
        }
      }
    }
    
    // 组合数据
    const booksWithCategories = books.map(book => {
      const categoryInfo = categoriesMap[book.categoryId];
      return {
        ...book,
        categoryName: categoryInfo ? categoryInfo.name : '未分类',
        categoryIcon: categoryInfo ? categoryInfo.icon : '📚',
        categoryColor: categoryInfo ? categoryInfo.categoryColor : '#1890ff'
      };
    });
    
    console.log(`✅ 获取到 ${result.data.length} 本新书`);
    return Response.success(booksWithCategories);
  } catch (error) {
    console.error('获取新书推荐失败:', error);
    return Response.error('获取新书推荐失败: ' + error.message, 500);
  }
}

// 获取经典必读
async function getClassicBooks(data) {
  console.log('📜 获取经典必读');
  const { limit = 10 } = data;
  
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');
  
  try {
    const result = await bookCollection
      .where({
        isRecommend: true,
        recommendType: db.command.in(['classic']),
        status: '完结'
      })
      .orderBy('recommendWeight', 'desc')
      .orderBy('popularity', 'desc')
      .limit(limit)
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        description: true,
        level: true,
        totalChapters: true,
        likeCount: true,
        popularity: true,
        recommendReason: true,
        categoryId: true
      })
      .get();
    
    // ✅ 获取分类信息
    const books = result.data;
    const categoriesMap = {};
    
    if (books.length > 0) {
      const uniqueCategoryIds = [...new Set(books.map(book => book.categoryId).filter(id => id))];
      
      if (uniqueCategoryIds.length > 0) {
        for (const catId of uniqueCategoryIds) {
          try {
            const categoryResult = await categoryCollection.doc(catId).get();
            if (categoryResult.data.length > 0) {
              categoriesMap[catId] = categoryResult.data[0];
            }
          } catch (error) {
            console.error(`查找分类 ${catId} 失败:`, error);
          }
        }
      }
    }
    
    // 组合数据
    const booksWithCategories = books.map(book => {
      const categoryInfo = categoriesMap[book.categoryId];
      return {
        ...book,
        categoryName: categoryInfo ? categoryInfo.name : '未分类',
        categoryIcon: categoryInfo ? categoryInfo.icon : '📚',
        categoryColor: categoryInfo ? categoryInfo.categoryColor : '#1890ff'
      };
    });
    
    console.log(`✅ 获取到 ${result.data.length} 本经典书籍`);
    return Response.success(booksWithCategories);
  } catch (error) {
    console.error('获取经典书籍失败:', error);
    return Response.error('获取经典书籍失败: ' + error.message, 500);
  }
}

// 获取畅销热门
async function getBestsellers(data) {
  console.log('🔥 获取畅销热门');
  const { limit = 10 } = data;
  
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');
  
  try {
    const result = await bookCollection
      .where({
        isRecommend: true,
        recommendType: db.command.in(['hot_sale']),
        status: '完结'
      })
      .orderBy('recommendWeight', 'desc')
      .orderBy('popularity', 'desc')
      .limit(limit)
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        description: true,
        level: true,
        totalChapters: true,
        likeCount: true,
        popularity: true,
        recommendBadge: true,
        categoryId: true
      })
      .get();
    
    // ✅ 获取分类信息
    const books = result.data;
    const categoriesMap = {};
    
    if (books.length > 0) {
      const uniqueCategoryIds = [...new Set(books.map(book => book.categoryId).filter(id => id))];
      
      if (uniqueCategoryIds.length > 0) {
        for (const catId of uniqueCategoryIds) {
          try {
            const categoryResult = await categoryCollection.doc(catId).get();
            if (categoryResult.data.length > 0) {
              categoriesMap[catId] = categoryResult.data[0];
            }
          } catch (error) {
            console.error(`查找分类 ${catId} 失败:`, error);
          }
        }
      }
    }
    
    // 组合数据
    const booksWithCategories = books.map(book => {
      const categoryInfo = categoriesMap[book.categoryId];
      return {
        ...book,
        categoryName: categoryInfo ? categoryInfo.name : '未分类',
        categoryIcon: categoryInfo ? categoryInfo.icon : '📚',
        categoryColor: categoryInfo ? categoryInfo.categoryColor : '#1890ff'
      };
    });
    
    console.log(`✅ 获取到 ${result.data.length} 本畅销书籍`);
    return Response.success(booksWithCategories);
  } catch (error) {
    console.error('获取畅销书籍失败:', error);
    return Response.error('获取畅销书籍失败: ' + error.message, 500);
  }
}

// 获取新书推荐
async function getNewBooks(data) {
  const { limit = 10 } = data;
  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');

  try {
    const result = await bookCollection
      .where({
        status: '完结'
      })
      .orderBy('createTime', 'desc')
      .limit(limit)
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        level: true,
        createTime: true,
        totalChapters: true,
        recommendBadge: true,
        isRecommend: true,
        categoryId: true
      })
      .get();
    
    // ✅ 获取分类信息
    const books = result.data;
    const categoriesMap = {};
    
    if (books.length > 0) {
      const uniqueCategoryIds = [...new Set(books.map(book => book.categoryId).filter(id => id))];
      
      if (uniqueCategoryIds.length > 0) {
        for (const catId of uniqueCategoryIds) {
          try {
            const categoryResult = await categoryCollection.doc(catId).get();
            if (categoryResult.data.length > 0) {
              categoriesMap[catId] = categoryResult.data[0];
            }
          } catch (error) {
            console.error(`查找分类 ${catId} 失败:`, error);
          }
        }
      }
    }
    
    // 组合数据
    const booksWithCategories = books.map(book => {
      const categoryInfo = categoriesMap[book.categoryId];
      return {
        ...book,
        categoryName: categoryInfo ? categoryInfo.name : '未分类',
        categoryIcon: categoryInfo ? categoryInfo.icon : '📚',
        categoryColor: categoryInfo ? categoryInfo.categoryColor : '#1890ff'
      };
    });

    return Response.success(booksWithCategories);
  } catch (error) {
    console.error('获取新书失败:', error);
    return Response.error('获取新书失败: ' + error.message, 500);
  }
}

// 获取书籍详情 - 完整修复版
async function getBookDetail(data) {
  // ✅ 修复：支持多种参数名
  let bookId = data.bookId || data.id || data._id;

  if (!bookId) {
    console.error('❌ 书籍ID不能为空，传入数据:', data);
    return Response.validationError('书籍ID不能为空');
  }

  console.log(`📖 获取书籍详情，原始ID: ${bookId}, 类型: ${typeof bookId}`);

  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');
  const chapterCollection = db.collection('book-chapter');

  try {
    // 🚨 关键修复：处理不同格式的ID查找
    let bookResult = null;
    let actualBookId = bookId;
    
    // 方法1：尝试按字符串ID直接查找
    console.log(`🔍 方法1：尝试按字符串ID ${bookId} 查找`);
    try {
      bookResult = await bookCollection.doc(String(bookId)).get();
      console.log(`方法1结果: ${bookResult.data.length} 条记录`);
    } catch (error) {
      console.warn(`方法1失败: ${error.message}`);
      bookResult = { data: [] };
    }
    
    // 方法2：如果没找到，尝试按数字ID查找（因为数据库中的ID可能是数字）
    if (bookResult.data.length === 0) {
      console.log(`🔍 方法2：尝试按数字ID查找`);
      
      // 将ID转换为数字（如果可能）
      const numericId = parseInt(bookId);
      if (!isNaN(numericId)) {
        console.log(`转换为数字ID: ${numericId}`);
        
        try {
          // 尝试两种可能的字段名：_id 或 id
          bookResult = await bookCollection
            .where(db.command.or([
              { _id: numericId },
              { id: numericId }
            ]))
            .limit(1)
            .get();
          
          console.log(`方法2结果: ${bookResult.data.length} 条记录`);
        } catch (error) {
          console.warn(`方法2失败: ${error.message}`);
          bookResult = { data: [] };
        }
      }
    }
    
    // 方法3：如果还没找到，尝试按标题或作者搜索
    if (bookResult.data.length === 0) {
      console.log(`🔍 方法3：尝试搜索书籍 ${bookId}`);
      
      try {
        bookResult = await bookCollection
          .where(db.command.or([
            { title: new RegExp(bookId, 'i') },
            { author: new RegExp(bookId, 'i') },
            { _id: String(bookId) }
          ]))
          .limit(1)
          .get();
        
        console.log(`方法3结果: ${bookResult.data.length} 条记录`);
      } catch (error) {
        console.warn(`方法3失败: ${error.message}`);
        bookResult = { data: [] };
      }
    }
    
    // 方法4：最后尝试，假设bookId可能是MongoDB的ObjectId
    if (bookResult.data.length === 0) {
      console.log(`🔍 方法4：尝试使用特殊查询`);
      
      try {
        // 查询所有书籍，然后在内存中匹配
        const allBooks = await bookCollection
          .where({ status: '完结' })
          .limit(100)
          .get();
        
        // 在内存中查找匹配的书籍
        const matchedBooks = allBooks.data.filter(book => {
          // 检查各种可能的ID字段
          const idFields = ['_id', 'id', 'bookId'];
          return idFields.some(field => {
            const value = book[field];
            if (!value) return false;
            
            // 进行宽松比较
            return String(value) === String(bookId) || 
                   value == bookId; // 使用 == 进行类型转换比较
          });
        });
        
        if (matchedBooks.length > 0) {
          bookResult.data = [matchedBooks[0]];
          console.log(`✅ 在内存中找到匹配的书籍: ${matchedBooks[0].title}`);
        }
      } catch (error) {
        console.warn(`方法4失败: ${error.message}`);
      }
    }
    
    if (bookResult.data.length === 0) {
      console.log(`❌ 书籍不存在，ID: ${bookId}`);
      return Response.notFound('书籍不存在');
    }

    const book = bookResult.data[0];
    actualBookId = book._id; // 使用数据库中的实际ID
    console.log(`✅ 找到书籍: ${book.title}, 数据库ID: ${actualBookId}, 类型: ${typeof actualBookId}`);

    // ✅ 获取分类信息
    let category = {};
    if (book.categoryId) {
      try {
        console.log(`🔍 查找分类，categoryId: ${book.categoryId}, 类型: ${typeof book.categoryId}`);
        
        // 方法1：直接按ID查找
        const categoryResult = await categoryCollection.doc(book.categoryId).get();
        if (categoryResult.data.length > 0) {
          category = categoryResult.data[0];
        } else {
          // 方法2：尝试将数字categoryId转为字符串查找
          const strCategoryId = String(book.categoryId);
          const strCategoryResult = await categoryCollection.doc(strCategoryId).get();
          if (strCategoryResult.data.length > 0) {
            category = strCategoryResult.data[0];
          } else {
            // 方法3：尝试按名称匹配
            const fallbackResult = await categoryCollection
              .where({
                name: new RegExp(`^${book.categoryId}$`, 'i')
              })
              .limit(1)
              .get();
            
            if (fallbackResult.data.length > 0) {
              category = fallbackResult.data[0];
            } else {
              console.warn(`⚠️ 未找到分类信息，categoryId: ${book.categoryId}`);
            }
          }
        }
        
        if (category.name) {
          console.log(`✅ 找到分类: ${category.name}`);
        }
      } catch (error) {
        console.error(`获取分类 ${book.categoryId} 失败:`, error);
      }
    }

    // 获取章节信息
    let chapters = [];
    try {
      console.log(`🔍 获取章节，bookId: ${actualBookId}`);
      const chaptersResult = await chapterCollection
        .where({ bookId: actualBookId })
        .orderBy('sort', 'asc')
        .limit(10)
        .field({
          _id: true,
          title: true,
          duration: true,
          isFree: true,
          sort: true,
          audioUrl: true
        })
        .get();
      
      chapters = chaptersResult.data;
      console.log(`✅ 找到 ${chapters.length} 个章节`);
    } catch (error) {
      console.error('获取章节失败:', error);
    }

    // 获取相关书籍（同分类）
    let relatedBooks = [];
    if (book.categoryId) {
      try {
        console.log(`🔍 查找相关书籍，categoryId: ${book.categoryId}`);
        
        // ✅ 修复：处理数字和字符串类型的分类ID
        const queryCategoryId = parseInt(book.categoryId);
        const finalCategoryId = isNaN(queryCategoryId) ? book.categoryId : queryCategoryId;
        
        const relatedBooksResult = await bookCollection
          .where({
            categoryId: finalCategoryId,
            _id: db.command.neq(actualBookId),
            status: '完结'
          })
          .orderBy('popularity', 'desc')
          .limit(4)
          .field({
            _id: true,
            title: true,
            cover: true,
            author: true,
            level: true,
            recommendBadge: true,
            popularity: true
          })
          .get();
        
        relatedBooks = relatedBooksResult.data;
        console.log(`✅ 找到 ${relatedBooks.length} 本相关书籍`);
      } catch (error) {
        console.error('获取相关书籍失败:', error);
      }
    }

    // 获取类似书籍（同级别）
    let similarBooks = [];
    try {
      const similarBooksResult = await bookCollection
        .where({
          level: book.level,
          _id: db.command.neq(actualBookId),
          status: '完结'
        })
        .orderBy('popularity', 'desc')
        .limit(3)
        .field({
          _id: true,
          title: true,
          cover: true,
          author: true,
          level: true
        })
        .get();
      
      similarBooks = similarBooksResult.data;
    } catch (error) {
      console.error('获取类似书籍失败:', error);
    }

    // 格式化返回数据
    const result = {
      ...book,
      // 确保有标准的ID字段
      id: actualBookId,
      _id: actualBookId,
      
      // 分类信息
      categoryName: category.name || '未分类',
      categoryIcon: category.icon || '📚',
      categoryColor: category.categoryColor || '#1890ff',
      categoryDescription: category.description || '',
      
      // 章节信息
      chapters: chapters,
      
      // 相关推荐
      relatedBooks: relatedBooks,
      similarBooks: similarBooks,
      
      // 格式化一些字段
      formattedDuration: formatDuration(book.totalDuration || 0),
      isFree: book.level === '初级' || false,
      rating: calculateBookRating(book.popularity || 0, book.likeCount || 0),
      
      // 添加一些计算字段
      chapterCount: chapters.length,
      isPopular: book.popularity > 5000,
      isNew: Date.now() - book.createTime < 30 * 24 * 60 * 60 * 1000 // 30天内
    };

    console.log(`✅ 书籍详情获取成功: ${book.title}`);
    console.log(`📊 返回数据摘要: 章节数 ${chapters.length}, 相关书籍 ${relatedBooks.length}`);
    
    return Response.success(result);
    
  } catch (error) {
    console.error('获取书籍详情失败:', error);
    return Response.error('获取书籍详情失败: ' + error.message, 500);
  }
}

// 辅助函数：格式化时长
function formatDuration(seconds) {
  if (!seconds) return '1小时';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? `${minutes}分钟` : ''}`;
  }
  return `${minutes}分钟`;
}

// 辅助函数：计算书籍评分
function calculateBookRating(popularity, likeCount) {
  const baseRating = 4.0;
  const popularityFactor = Math.min(1.0, popularity / 10000);
  const likeFactor = Math.min(0.5, likeCount / 2000);
  const rating = Math.min(5.0, baseRating + popularityFactor + likeFactor);
  return rating.toFixed(1);
}

// 添加书籍
async function addBook(data) {
  const { title, author, cover, description, categoryId, level, totalChapters, totalDuration } = data;

  if (!title || !author || !cover || !categoryId) {
    return Response.validationError('标题、作者、封面和分类为必填项');
  }

  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');

  try {
    // 检查分类是否存在
    const categoryResult = await categoryCollection.doc(categoryId).get();
    if (categoryResult.data.length === 0) {
      return Response.error('分类不存在', 404);
    }

    // 检查是否已存在相同标题的书籍
    const existBook = await bookCollection.where({ title, categoryId }).get();
    if (existBook.data.length > 0) {
      return Response.error('该分类下已存在相同标题的书籍', 400);
    }

    // 创建书籍
    const bookData = {
      title,
      author,
      cover,
      description: description || '',
      categoryId,
      level: level || '中级',
      totalChapters: totalChapters || 0,
      totalDuration: totalDuration || 0,
      likeCount: 0,
      commentCount: 0,
      status: '完结',
      popularity: 0,
      isRecommend: false,
      recommendType: [],
      recommendWeight: 0,
      recommendOrder: 9999,
      createTime: Date.now(),
      updateTime: Date.now()
    };

    const addResult = await bookCollection.add(bookData);
    
    console.log(`✅ 书籍添加成功: ${title}`);
    return Response.success({ bookId: addResult.id }, '书籍添加成功');
    
  } catch (error) {
    console.error('添加书籍失败:', error);
    return Response.error('添加书籍失败: ' + error.message, 500);
  }
}

// 更新书籍
async function updateBook(data) {
  const { bookId, ...updateData } = data;

  if (!bookId) {
    return Response.validationError('书籍ID不能为空');
  }

  const bookCollection = db.collection('book-info');
  const categoryCollection = db.collection('book-category');

  try {
    // 获取原始书籍信息
    const originalBookResult = await bookCollection.doc(bookId).get();
    if (originalBookResult.data.length === 0) {
      return Response.notFound('书籍不存在');
    }

    const originalBook = originalBookResult.data[0];
    const originalCategoryId = originalBook.categoryId;
    const newCategoryId = updateData.categoryId;
    const categoryChanged = newCategoryId && newCategoryId !== originalCategoryId;

    // 如果分类变更了，需要验证新分类
    if (categoryChanged) {
      // 检查新分类是否存在
      const newCategoryResult = await categoryCollection.doc(newCategoryId).get();
      if (newCategoryResult.data.length === 0) {
        return Response.error('新分类不存在', 404);
      }

      // 检查新分类下是否已有相同标题的书籍
      const existBook = await bookCollection.where({ 
        title: updateData.title || originalBook.title, 
        categoryId: newCategoryId,
        _id: db.command.neq(bookId)
      }).get();
      
      if (existBook.data.length > 0) {
        return Response.error('新分类下已存在相同标题的书籍', 400);
      }
    }

    // 更新书籍
    updateData.updateTime = Date.now();
    await bookCollection.doc(bookId).update(updateData);
    
    return Response.success(null, '书籍更新成功');
    
  } catch (error) {
    console.error('更新书籍失败:', error);
    return Response.error('更新书籍失败: ' + error.message, 500);
  }
}

// 删除书籍
async function deleteBook(data) {
  const { bookId } = data;

  if (!bookId) {
    return Response.validationError('书籍ID不能为空');
  }

  const bookCollection = db.collection('book-info');

  try {
    const bookResult = await bookCollection.doc(bookId).get();

    if (bookResult.data.length === 0) {
      return Response.notFound('书籍不存在');
    }

    // 删除书籍
    await bookCollection.doc(bookId).remove();
    
    console.log(`✅ 书籍删除成功: ${bookId}`);
    return Response.success(null, '书籍删除成功');
    
  } catch (error) {
    console.error('删除书籍失败:', error);
    return Response.error('删除书籍失败: ' + error.message, 500);
  }
}

// 点赞书籍
async function likeBook(userId, data) {
  const { bookId } = data;

  if (!bookId) {
    return Response.validationError('书籍ID不能为空');
  }

  const db = uniCloud.database();
  const bookCollection = db.collection('book-info');
  const likeCollection = db.collection('user-like');

  try {
    // 检查书籍是否存在
    const bookResult = await bookCollection.doc(bookId).get();
    if (bookResult.data.length === 0) {
      return Response.notFound('书籍不存在');
    }

    // 检查是否已点赞
    const existLike = await likeCollection.where({
      userId,
      targetType: '书籍',
      targetId: bookId
    }).get();

    if (existLike.data.length > 0) {
      return Response.error('已经点赞过了', 400);
    }

    // 开始事务操作
    const transaction = await db.startTransaction();
    
    try {
      // 添加点赞记录
      await transaction.collection('user-like').add({
        userId,
        targetType: '书籍',
        targetId: bookId,
        likeTime: Date.now()
      });

      // 更新书籍点赞数
      await transaction.collection('book-info').doc(bookId).update({
        likeCount: $.inc(1),
        popularity: $.inc(10),
        updateTime: Date.now()
      });

      await transaction.commit();
      
      return Response.success(null, '点赞成功');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('点赞失败:', error);
    return Response.error('点赞失败: ' + error.message, 500);
  }
}

// 取消点赞
async function cancelLikeBook(userId, data) {
  const { bookId } = data;

  if (!bookId) {
    return Response.validationError('书籍ID不能为空');
  }

  const db = uniCloud.database();
  const bookCollection = db.collection('book-info');
  const likeCollection = db.collection('user-like');

  try {
    // 查找点赞记录
    const likeResult = await likeCollection.where({
      userId,
      targetType: '书籍',
      targetId: bookId
    }).get();

    if (likeResult.data.length === 0) {
      return Response.error('还未点赞', 400);
    }

    // 开始事务操作
    const transaction = await db.startTransaction();
    
    try {
      // 删除点赞记录
      await transaction.collection('user-like').doc(likeResult.data[0]._id).remove();

      // 更新书籍点赞数
      await transaction.collection('book-info').doc(bookId).update({
        likeCount: $.inc(-1),
        popularity: $.inc(-10),
        updateTime: Date.now()
      });

      await transaction.commit();
      
      return Response.success(null, '取消点赞成功');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('取消点赞失败:', error);
    return Response.error('取消点赞失败: ' + error.message, 500);
  }
}

async function getUserBookStats(data) {
    const { userId } = data;
    
    if (!userId) {
      return Response.validationError('用户ID不能为空');
    }
    
    const db = uniCloud.database();
    const favoritesCollection = db.collection('user-favorites');
    const downloadCollection = db.collection('user-download');
    const finishedCollection = db.collection('user-finished');
    const listenHistoryCollection = db.collection('listen-history');
    const bookCollection = db.collection('book-info');
    
    try {
      console.log(`📊 开始爬取用户 ${userId} 的书籍统计数据`);
      
      // 1. 统计收藏数量
      const favoritesResult = await favoritesCollection
        .where({ userId: parseInt(userId) })
        .count();
      const favoritesCount = favoritesResult.total;
      
      // 2. 统计下载数量（按书籍去重）
      const downloadResult = await downloadCollection
        .aggregate()
        .match({ userId: parseInt(userId) })
        .lookup({
          from: 'book-chapter',
          localField: 'chapterId',
          foreignField: '_id',
          as: 'chapterInfo'
        })
        .group({
          _id: { 
            $arrayElemAt: ['$chapterInfo.bookId', 0] 
          },
          count: { $sum: 1 }
        })
        .end();
      const downloadedCount = downloadResult.data.length;
      
      // 3. 统计已完成数量
      const finishedResult = await finishedCollection
        .where({ userId: parseInt(userId) })
        .count();
      const completedCount = finishedResult.total;
      
      // 4. 统计进行中数量（有收听记录但未完成的书籍）
      const inProgressResult = await listenHistoryCollection
        .aggregate()
        .match({ 
          userId: parseInt(userId),
          completed: false
        })
        .lookup({
          from: 'book-chapter',
          localField: 'chapterId',
          foreignField: '_id',
          as: 'chapterInfo'
        })
        .group({
          _id: { 
            $arrayElemAt: ['$chapterInfo.bookId', 0] 
          },
          latestListenTime: { $max: '$listenTime' }
        })
        .end();
      const inProgressCount = inProgressResult.data.length;
      
      // 5. 统计总书籍数量（所有涉及到的书籍）
      const allBookIds = new Set();
      
      // 从收藏表获取书籍ID
      const favBooks = await favoritesCollection
        .where({ userId: parseInt(userId) })
        .field({ bookId: true })
        .get();
      favBooks.data.forEach(item => allBookIds.add(item.bookId));
      
      // 从完成表获取书籍ID
      const finBooks = await finishedCollection
        .where({ userId: parseInt(userId) })
        .field({ bookId: true })
        .get();
      finBooks.data.forEach(item => allBookIds.add(item.bookId));
      
      // 从收听记录获取书籍ID
      const listenRecords = await listenHistoryCollection
        .aggregate()
        .match({ userId: parseInt(userId) })
        .lookup({
          from: 'book-chapter',
          localField: 'chapterId',
          foreignField: '_id',
          as: 'chapterInfo'
        })
        .group({
          _id: { 
            $arrayElemAt: ['$chapterInfo.bookId', 0] 
          }
        })
        .end();
      listenRecords.data.forEach(item => allBookIds.add(item._id));
      
      const totalBooksCount = allBookIds.size;
      
      return Response.success({
        completed: completedCount,
        downloaded: downloadedCount,
        favorites: favoritesCount,
        inProgress: inProgressCount,
        total: totalBooksCount,
        timestamp: Date.now()
      }, '获取书籍统计成功');
      
    } catch (error) {
      console.error('爬取用户书籍统计失败:', error);
      return Response.error('获取书籍统计数据失败: ' + error.message, 500);
    }
  }
  
  // 🚨 新增：获取个人中心完整数据（真正的爬取版本）
  async function getUserProfileData(data) {
    const { userId } = data;
    
    if (!userId) {
      return Response.validationError('用户ID不能为空');
    }
    
    const db = uniCloud.database();
    const userCollection = db.collection('user');
    
    try {
      console.log(`🔍 开始爬取用户 ${userId} 的完整个人中心数据`);
      
      // 1. 获取用户基本信息
      const userResult = await userCollection
        .where({ _id: parseInt(userId) })
        .field({
          _id: true,
          username: true,
          phone: true,
          email: true,
          avatar: true,
          nickname: true,
          isVip: true,
          level: true,
          learningDays: true,
          createTime: true
        })
        .get();
      
      if (userResult.data.length === 0) {
        return Response.notFound('用户不存在');
      }
      
      const userInfo = userResult.data[0];
      
      // 2. 获取学习统计数据（从原有接口）
      const studyStats = await getUserStudyStats(data);
      const studyData = studyStats.data || {
        totalMinutes: 0,
        booksCount: 0,
        daysCount: 0,
        wordsCount: 0,
        dailyGoal: 30,
        goalProgress: 0
      };
      
      // 3. 获取书籍统计数据（调用上面的爬取方法）
      const bookStatsResult = await getUserBookStats(data);
      const bookStats = bookStatsResult.data || {
        completed: 0,
        downloaded: 0,
        favorites: 0,
        inProgress: 0,
        total: 0
      };
      
      // 4. 格式化返回数据
      return Response.success({
        userInfo: {
          ...userInfo,
          userId: userInfo._id,
          userIdNumber: userInfo._id
        },
        studyData: studyData,
        bookStats: bookStats
      }, '获取个人中心数据成功');
      
    } catch (error) {
      console.error('爬取个人中心数据失败:', error);
      return Response.error('获取个人中心数据失败: ' + error.message, 500);
    }
  }
  
  // 🚨 新增：爬取学习统计数据
  async function getUserStudyStats(data) {
    const { userId } = data;
    
    if (!userId) {
      return Response.validationError('用户ID不能为空');
    }
    
    const db = uniCloud.database();
    const finishedCollection = db.collection('user-finished');
    const listenHistoryCollection = db.collection('listen-history');
    
    try {
      console.log(`📚 开始爬取用户 ${userId} 的学习统计数据`);
      
      // 1. 计算总学习时间（从完成表中获取）
      const finishedBooks = await finishedCollection
        .where({ userId: parseInt(userId) })
        .field({ totalTimeSpent: true })
        .get();
      
      let totalSeconds = 0;
      finishedBooks.data.forEach(book => {
        totalSeconds += book.totalTimeSpent || 0;
      });
      
      // 2. 计算总学习天数（从收听记录中统计）
      const listenRecords = await listenHistoryCollection
        .aggregate()
        .match({ userId: parseInt(userId) })
        .group({
          _id: {
            year: { $year: '$listenTime' },
            month: { $month: '$listenTime' },
            day: { $dayOfMonth: '$listenTime' }
          }
        })
        .end();
      
      const daysCount = listenRecords.data.length;
      
      // 3. 计算书籍数量
      const bookCount = await finishedCollection
        .where({ userId: parseInt(userId) })
        .count();
      
      // 4. 估算单词数（假设每分钟学习10个单词）
      const totalMinutes = Math.floor(totalSeconds / 60);
      const estimatedWords = totalMinutes * 10;
      
      // 5. 计算今日进度
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;
      
      const todayListen = await listenHistoryCollection
        .where({
          userId: parseInt(userId),
          listenTime: db.command.gte(todayStart).and(db.command.lt(todayEnd))
        })
        .get();
      
      let todaySeconds = 0;
      todayListen.data.forEach(record => {
        todaySeconds += record.progress || 0;
      });
      const todayMinutes = Math.floor(todaySeconds / 60);
      const dailyGoal = 30; // 默认30分钟
      const goalProgress = Math.min(100, Math.floor((todayMinutes / dailyGoal) * 100));
      
      return Response.success({
        totalMinutes: totalMinutes,
        booksCount: bookCount.total,
        daysCount: daysCount,
        wordsCount: estimatedWords,
        dailyGoal: dailyGoal,
        goalProgress: goalProgress
      }, '获取学习统计成功');
      
    } catch (error) {
      console.error('爬取学习统计失败:', error);
      return Response.error('获取学习统计数据失败: ' + error.message, 500);
    }
  }

// ==================== 用户书籍统计相关API ====================

// ✅ 新增：添加收藏
async function addToFavorites(userId, data) {
  const { bookId } = data;

  if (!bookId) {
    return Response.validationError('书籍ID不能为空');
  }

  const favoritesCollection = db.collection('user-favorites');
  
  try {
    // 检查是否已收藏
    const existFavorite = await favoritesCollection
      .where({
        userId: userId,
        bookId: bookId
      })
      .get();

    if (existFavorite.data.length > 0) {
      return Response.error('已经收藏过了', 400);
    }

    // 添加收藏记录
    await favoritesCollection.add({
      userId: userId,
      bookId: bookId,
      createTime: Date.now()
    });

    return Response.success(null, '收藏成功');
  } catch (error) {
    console.error('收藏失败:', error);
    return Response.error('收藏失败: ' + error.message, 500);
  }
}

// ✅ 新增：移除收藏
async function removeFromFavorites(userId, data) {
  const { bookId } = data;

  if (!bookId) {
    return Response.validationError('书籍ID不能为空');
  }

  const favoritesCollection = db.collection('user-favorites');
  
  try {
    // 查找收藏记录
    const favoriteResult = await favoritesCollection
      .where({
        userId: userId,
        bookId: bookId
      })
      .get();

    if (favoriteResult.data.length === 0) {
      return Response.error('还未收藏', 400);
    }

    // 删除收藏记录
    await favoritesCollection.doc(favoriteResult.data[0]._id).remove();

    return Response.success(null, '取消收藏成功');
  } catch (error) {
    console.error('取消收藏失败:', error);
    return Response.error('取消收藏失败: ' + error.message, 500);
  }
}

// ✅ 新增：检查是否收藏
async function checkFavorite(userId, data) {
  const { bookId } = data;

  if (!bookId) {
    return Response.validationError('书籍ID不能为空');
  }

  const favoritesCollection = db.collection('user-favorites');
  
  try {
    const result = await favoritesCollection
      .where({
        userId: userId,
        bookId: bookId
      })
      .count();

    return Response.success({
      isFavorite: result.total > 0
    });
  } catch (error) {
    console.error('检查收藏失败:', error);
    return Response.error('检查收藏失败: ' + error.message, 500);
  }
}

// ✅ 新增：获取我的收藏列表
async function getMyFavorites(userId, data) {
  const { page = 1, pageSize = 10 } = data;
  const { skip, limit } = handlePagination(page, pageSize);
  
  const favoritesCollection = db.collection('user-favorites');
  const bookCollection = db.collection('book-info');
  
  try {
    const [favoritesResult, totalResult] = await Promise.all([
      favoritesCollection
        .where({ userId: userId })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(limit)
        .get(),
      favoritesCollection.where({ userId: userId }).count()
    ]);

    const favorites = favoritesResult.data;
    
    if (favorites.length === 0) {
      return Response.success({
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      });
    }

    // 获取书籍详情
    const bookIds = favorites.map(fav => fav.bookId);
    const booksResult = await bookCollection
      .where({
        _id: db.command.in(bookIds)
      })
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        description: true,
        level: true,
        totalChapters: true,
        likeCount: true,
        recommendBadge: true
      })
      .get();

    // 将书籍信息与收藏时间组合
    const booksMap = {};
    booksResult.data.forEach(book => {
      booksMap[book._id] = book;
    });

    const list = favorites.map(fav => ({
      ...booksMap[fav.bookId],
      favoriteTime: fav.createTime
    })).filter(item => item.title); // 过滤掉可能不存在的书籍

    return Response.success({
      list: list,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    return Response.error('获取收藏列表失败: ' + error.message, 500);
  }
}

// ✅ 新增：记录下载
async function recordDownload(userId, data) {
  const { bookId, chapterId } = data;

  if (!bookId && !chapterId) {
    return Response.validationError('书籍ID或章节ID不能为空');
  }

  const downloadCollection = db.collection('user-download');
  
  try {
    // 记录下载
    await downloadCollection.add({
      userId: userId,
      bookId: bookId || '',
      chapterId: chapterId || '',
      downloadTime: Date.now()
    });

    return Response.success(null, '下载记录成功');
  } catch (error) {
    console.error('记录下载失败:', error);
    return Response.error('记录下载失败: ' + error.message, 500);
  }
}

// ✅ 新增：获取我的下载列表
async function getMyDownloads(userId, data) {
  const { page = 1, pageSize = 10 } = data;
  const { skip, limit } = handlePagination(page, pageSize);
  
  const downloadCollection = db.collection('user-download');
  const bookCollection = db.collection('book-info');
  const chapterCollection = db.collection('book-chapter');
  
  try {
    const [downloadsResult, totalResult] = await Promise.all([
      downloadCollection
        .where({ userId: userId })
        .orderBy('downloadTime', 'desc')
        .skip(skip)
        .limit(limit)
        .get(),
      downloadCollection.where({ userId: userId }).count()
    ]);

    const downloads = downloadsResult.data;
    
    if (downloads.length === 0) {
      return Response.success({
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      });
    }

    // 获取书籍和章节信息
    const bookIds = downloads.filter(d => d.bookId).map(d => d.bookId);
    const chapterIds = downloads.filter(d => d.chapterId).map(d => d.chapterId);
    
    const [booksResult, chaptersResult] = await Promise.all([
      bookIds.length > 0 ? bookCollection
        .where({
          _id: db.command.in(bookIds)
        })
        .field({
          _id: true,
          title: true,
          author: true,
          cover: true
        })
        .get() : { data: [] },
      chapterIds.length > 0 ? chapterCollection
        .where({
          _id: db.command.in(chapterIds)
        })
        .field({
          _id: true,
          title: true,
          bookId: true
        })
        .get() : { data: [] }
    ]);

    // 创建映射
    const booksMap = {};
    booksResult.data.forEach(book => {
      booksMap[book._id] = book;
    });

    const chaptersMap = {};
    chaptersResult.data.forEach(chapter => {
      chaptersMap[chapter._id] = chapter;
    });

    // 组合数据
    const list = downloads.map(download => {
      const item = {
        downloadTime: download.downloadTime
      };
      
      if (download.bookId && booksMap[download.bookId]) {
        Object.assign(item, booksMap[download.bookId]);
        item.type = 'book';
      } else if (download.chapterId && chaptersMap[download.chapterId]) {
        const chapter = chaptersMap[download.chapterId];
        Object.assign(item, chapter);
        item.type = 'chapter';
      }
      
      return item;
    }).filter(item => item.title); // 过滤掉可能不存在的项目

    return Response.success({
      list: list,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取下载列表失败:', error);
    return Response.error('获取下载列表失败: ' + error.message, 500);
  }
}

// ✅ 新增：标记为已完成
async function markAsCompleted(userId, data) {
  const { bookId, totalTimeSpent } = data;

  if (!bookId) {
    return Response.validationError('书籍ID不能为空');
  }

  const finishedCollection = db.collection('user-finished');
  
  try {
    // 检查是否已完成
    const existCompleted = await finishedCollection
      .where({
        userId: userId,
        bookId: bookId
      })
      .get();

    if (existCompleted.data.length > 0) {
      return Response.error('已经标记为完成了', 400);
    }

    // 标记为完成
    await finishedCollection.add({
      userId: userId,
      bookId: bookId,
      totalTimeSpent: totalTimeSpent || 0,
      completeTime: Date.now()
    });

    return Response.success(null, '标记完成成功');
  } catch (error) {
    console.error('标记完成失败:', error);
    return Response.error('标记完成失败: ' + error.message, 500);
  }
}

// ✅ 新增：获取我的已完成列表
async function getMyCompleted(userId, data) {
  const { page = 1, pageSize = 10 } = data;
  const { skip, limit } = handlePagination(page, pageSize);
  
  const finishedCollection = db.collection('user-finished');
  const bookCollection = db.collection('book-info');
  
  try {
    const [completedResult, totalResult] = await Promise.all([
      finishedCollection
        .where({ userId: userId })
        .orderBy('completeTime', 'desc')
        .skip(skip)
        .limit(limit)
        .get(),
      finishedCollection.where({ userId: userId }).count()
    ]);

    const completed = completedResult.data;
    
    if (completed.length === 0) {
      return Response.success({
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      });
    }

    // 获取书籍详情
    const bookIds = completed.map(item => item.bookId);
    const booksResult = await bookCollection
      .where({
        _id: db.command.in(bookIds)
      })
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        description: true,
        level: true,
        totalChapters: true,
        totalDuration: true
      })
      .get();

    // 将书籍信息与完成时间组合
    const booksMap = {};
    booksResult.data.forEach(book => {
      booksMap[book._id] = book;
    });

    const list = completed.map(item => ({
      ...booksMap[item.bookId],
      completeTime: item.completeTime,
      totalTimeSpent: item.totalTimeSpent
    })).filter(item => item.title); // 过滤掉可能不存在的书籍

    return Response.success({
      list: list,
      pagination: {
        page,
        pageSize,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取完成列表失败:', error);
    return Response.error('获取完成列表失败: ' + error.message, 500);
  }
}

// ✅ 新增：获取我的进行中列表
async function getMyInProgress(userId, data) {
  const { page = 1, pageSize = 10 } = data;
  const { skip, limit } = handlePagination(page, pageSize);
  
  const listenHistoryCollection = db.collection('listen-history');
  const bookCollection = db.collection('book-info');
  const chapterCollection = db.collection('book-chapter');
  
  try {
    // 获取用户有收听记录但未完成的书籍
    const listenResult = await listenHistoryCollection
      .aggregate()
      .match({ 
        userId: userId,
        completed: false
      })
      .lookup({
        from: 'book-chapter',
        localField: 'chapterId',
        foreignField: '_id',
        as: 'chapterInfo'
      })
      .group({
        _id: { 
          $arrayElemAt: ['$chapterInfo.bookId', 0] 
        },
        latestListenTime: { $max: '$listenTime' },
        progress: { $max: '$progress' }
      })
      .skip(skip)
      .limit(limit)
      .end();

    const inProgressItems = listenResult.data;
    
    if (inProgressItems.length === 0) {
      return Response.success({
        list: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      });
    }

    // 获取书籍详情
    const bookIds = inProgressItems.map(item => item._id);
    const booksResult = await bookCollection
      .where({
        _id: db.command.in(bookIds)
      })
      .field({
        _id: true,
        title: true,
        author: true,
        cover: true,
        description: true,
        level: true,
        totalChapters: true,
        totalDuration: true
      })
      .get();

    // 将书籍信息与收听记录组合
    const booksMap = {};
    booksResult.data.forEach(book => {
      booksMap[book._id] = book;
    });

    const list = inProgressItems.map(item => ({
      ...booksMap[item._id],
      latestListenTime: item.latestListenTime,
      progress: item.progress || 0
    })).filter(item => item.title); // 过滤掉可能不存在的书籍

    // 获取总数
    const totalResult = await listenHistoryCollection
      .aggregate()
      .match({ 
        userId: userId,
        completed: false
      })
      .group({
        _id: '$chapterId'
      })
      .lookup({
        from: 'book-chapter',
        localField: '_id',
        foreignField: '_id',
        as: 'chapterInfo'
      })
      .group({
        _id: { 
          $arrayElemAt: ['$chapterInfo.bookId', 0] 
        }
      })
      .count('total')
      .end();

    const total = totalResult.data[0]?.total || 0;

    return Response.success({
      list: list,
      pagination: {
        page,
        pageSize,
        total: total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取进行中列表失败:', error);
    return Response.error('获取进行中列表失败: ' + error.message, 500);
  }
}

// ✅ 新增：获取用户所有书籍统计
async function getMyAllBookStats(userId, data) {
  try {
    console.log(`📊 开始获取用户 ${userId} 的所有书籍统计`);
    
    // 调用现有的统计函数
    const result = await getUserBookStats({ userId: userId });
    
    if (result && (result.success === true || result.code === 0)) {
      return Response.success(result.data || result, '获取书籍统计成功');
    } else {
      return Response.success({
        completed: 0,
        downloaded: 0,
        favorites: 0,
        inProgress: 0,
        total: 0,
        timestamp: Date.now()
      }, '获取书籍统计成功');
    }
  } catch (error) {
    console.error('获取书籍统计失败:', error);
    return Response.success({
      completed: 0,
      downloaded: 0,
      favorites: 0,
      inProgress: 0,
      total: 0,
      timestamp: Date.now()
    }, '获取书籍统计成功');
  }
}