const ejs = require('ejs')
const fs = require('fs-extra')
const path = require('path')
const marked = require('marked')
const matter = require('gray-matter')
const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime');
const zh = require('dayjs/locale/zh-cn');

// 路径常量
const PATHS = {
  content: {
    text1: path.join(__dirname, './content/posts/TEXT1.md'),
    text2: path.join(__dirname, './content/posts/TEXT2.md'),
    text3: path.join(__dirname, './content/posts/TEXT3.md'),
    text4: path.join(__dirname, './content/posts/TEXT4.md'),
    text5: path.join(__dirname, './content/posts/TEXT5.md')
  },
  templates: {
    page: path.join(__dirname, './templates/page.ejs'),
    div: path.join(__dirname, './templates/div.ejs'),
    index: path.join(__dirname, './templates/index.ejs'),
    post: path.join(__dirname, './templates/post.ejs'),
    base: path.join(__dirname, './templates/base.ejs')
  },
  output: {
    text1: path.join(__dirname, './dist/posts/TEXT1.html'),
    text2: path.join(__dirname, './dist/posts/TEXT2.html'),
    text3: path.join(__dirname, './dist/posts/TEXT3.html'),
    text4: path.join(__dirname, './dist/posts/TEXT4.html'),
    text5: path.join(__dirname, './dist/posts/TEXT5.html')
  }
}

// 处理单个文件的函数
async function processFile(fileKey, contentPath, outputPath) {
  try {
    // 1. 读取并解析Markdown文件
    const { data: frontMatter, content: markdownContent } = matter.read(contentPath)
    
    // 格式化日期
    dayjs.extend(relativeTime);
    dayjs.locale('zh-cn');
    frontMatter.date = dayjs(frontMatter.date).fromNow()

    //修改时间
    const stat = await fs.statSync(contentPath)
    const modifyTime = stat.mtime.toLocaleString('zh-CN')
    
    // 2. 渲染Markdown内容
    const article = await marked.parse(markdownContent)
    
    // 3. 渲染文章内容模板
    const postHtml = await ejs.renderFile(
      PATHS.templates.post,
      {
        title: frontMatter.title,
        date: frontMatter.date,
        modifyDate: modifyTime,
        description: frontMatter.description,
        content: article
      }
    )
    
    // 4. 渲染基础模板
    const baseHtml = await ejs.renderFile(
      PATHS.templates.base,
      { homeUrl:'../index1.html',
        currentPage: 'post',
        css: '../style/base.css',
        script:'../js/base.js',
        body: postHtml
      }
    )
    
    // 5. 写入文件
    await fs.outputFile(outputPath, baseHtml)
    console.log(`✅ ${fileKey} 生成成功: ${outputPath}`)
    
    // 返回用于首页的数据
    return {
      title: frontMatter.title,
      date: frontMatter.date,
      modifyTime: modifyTime,
      link: `./posts/${fileKey.toUpperCase()}.html`
    }
  } catch (error) {
    console.error(`❌ ${fileKey} 处理失败:`, error.message)
    throw error // 重新抛出错误以便外部捕获
  }
}

//分页逻辑
async function paginate(divFragments,pageSize,currentPage){
  const totalPage=Math.ceil(divFragments.length/pageSize)
  const startIndex=(currentPage-1)*pageSize
  const endIndex=Math.min(startIndex+pageSize,divFragments.length)
  return {
    totalPage,
    divs:divFragments.slice(startIndex,endIndex)
  }
}
// 获取首页所需数据
async function gainAllPosts(postsData) {
  try {
    // 对文章按日期排序（最新的在前）
    const sortedPosts = postsData.sort((a, b) => new Date(b.date) - new Date(a.date))
    
    // 生成所有文章的div片段
    const divFragments = []
    for (const post of sortedPosts) {
      const divHtml = await ejs.renderFile(
        PATHS.templates.div,
        {
          title: post.title,
          date: post.date,
          description: post.description,
          modifyDate: post.modifyTime,
          link: post.link
        }
      )
      divFragments.push(divHtml)
    }
    return divFragments
  } catch (error) {
    console.error('❌ 目录文章模块生成失败:', error.message)
    throw error
  }
}

//生成首页分页
async function generateIndexPage(divs,currentPage,totalPage) {
try{  
    const page= await ejs.renderFile(
      PATHS.templates.page,
    {
      currentPage: currentPage,
      totalPage: totalPage
    }
    )
    const index = await ejs.renderFile(
    PATHS.templates.index,
    { div: divs.join('\n'),
      page:page
     } // 将所有div片段连接起来
  )
  const indexHtml = await ejs.renderFile(
    PATHS.templates.base,
    {
      homeUrl: '#',
      currentPage: 'index',
      css: './style/base.css',
      script: './js/base.js',
      body: index
    }
  )
  // 写入首页文件
  await fs.outputFile(path.join(__dirname, `./dist/index${currentPage}.html`), indexHtml)
  console.log(`✅ 首页第${currentPage}页生成成功`)
} catch (error) {
    console.error('❌ 首页生成失败:', error.message)
  
}
}

// 主处理函数
async function generateSite() {
  try {
    console.log('🚀 开始生成站点...')
    
    // 并发处理所有文件
    const processingTasks = [
      processFile('text1', PATHS.content.text1, PATHS.output.text1),
      processFile('text2', PATHS.content.text2, PATHS.output.text2),
      processFile('text3', PATHS.content.text3, PATHS.output.text3),
      processFile('text4', PATHS.content.text4, PATHS.output.text4),
      processFile('text5', PATHS.content.text5, PATHS.output.text5)
    ]
    
    // 使用 Promise.all 并发执行所有任务
    const postsData = await Promise.all(processingTasks)
    
    // 得到首页数据
    const divFragments = await gainAllPosts(postsData)

    // 生成首页
    let flag=true
    let currentPage=1
    while(flag){
      const {totalPage,divs}=await paginate(divFragments,3,currentPage)
      await generateIndexPage(divs,currentPage,totalPage)
      currentPage++
      if(currentPage>totalPage){
        flag=false
      }
    }
    console.log('🎉 所有文件生成完成！')
  } catch (error) {
    console.error('💥 站点生成过程中发生错误:', error.message)
    process.exit(1)
  }
}

// 执行生成过程
generateSite()