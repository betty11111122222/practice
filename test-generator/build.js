const ejs = require('ejs')
const fs = require('fs-extra')
const path = require('path')
const marked = require('marked')
const matter = require('gray-matter')
const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
const zh = require('dayjs/locale/zh-cn')

// 路径常量
const PATHS = {
  inputDir: './content',
  outputDir: './dist',
  staticDir: {
    css:path.join(__dirname, './style/style.css'),
    js:path.join(__dirname, './js/script.js'),
    img:path.join(__dirname, './user.jpg')
  },
  templates: {
    page: path.join(__dirname, './templates/page.ejs'),
    div: path.join(__dirname, './templates/div.ejs'),
    index: path.join(__dirname, './templates/index.ejs'),
    post: path.join(__dirname, './templates/post.ejs'),
    base: path.join(__dirname, './templates/base.ejs')
  }
}

//获取静态文件(css/js)
async function copyStaticFiles() {
  try{
    console.log('🔍 正在复制静态文件...')
    await fs.copy(PATHS.staticDir.css,path.join(__dirname,PATHS.outputDir,'style.css'))
    await fs.copy(PATHS.staticDir.js,path.join(__dirname,PATHS.outputDir,'script.js'))
    await fs.copy(PATHS.staticDir.img,path.join(__dirname,PATHS.outputDir,'user.jpg'))
    console.log('✅ 静态文件复制成功')

  }catch(err){
    console.error('在复制静态文件时出错: ' + err.message)
    throw err
  }
}

// 扫描md文件路径
async function collectMdFiles(filePath) {
  const inputPaths = []
  try {
    const items = await fs.readdir(filePath, { withFileTypes: true })
    const promises = []
    
    for (const item of items) {
      const fullPath = path.join(filePath, item.name)
      if (item.isDirectory()) {
        promises.push(
          collectMdFiles(fullPath).then(subPaths => {
            inputPaths.push(...subPaths)
          })
        )
      } else if (item.isFile() && path.extname(item.name).toLowerCase() === '.md') {
        inputPaths.push(fullPath)
        console.log(`📁 找到MD文件: ${fullPath}`)
      }
    }

    await Promise.all(promises)
    return inputPaths
  } catch (err) {
    console.error('在收集md文件时出错: ' + err.message)
    throw err
  }
}

// 得到输入目录和输出目录
async function getInputAndOutputPaths() {
  try {
    const inputPaths = await collectMdFiles(PATHS.inputDir)
    
    if (inputPaths.length === 0) {
      console.log('⚠️  没有找到任何MD文件')
      return { inputPaths: [], outputPaths: [] }
    }
    
    const outputPaths = inputPaths.map((mdFile) => {
      const relativePath = path.relative(PATHS.inputDir, mdFile)
      const outputPath = path.join(
        PATHS.outputDir, 
        relativePath.replace(/\.md$/, '.html')
      )
      return outputPath
    })
    
    console.log(`📊 找到 ${inputPaths.length} 个MD文件`)
    return { inputPaths, outputPaths }
  } catch (err) {
    console.error('在获取输入输出路径时出错: ' + err.message)
    throw err
  }
}


// 处理单个文件的函数
async function processFile(fileKey, contentPath, outputPath,blogCount) {
  try {
    console.log(`🔄 正在处理第${fileKey}个文件: ${contentPath}`)
    
    // 1. 读取并解析Markdown文件
    const { data: frontMatter, content: markdownContent } = matter.read(contentPath)
    
    // 确保必要的front matter字段存在
    const originalDate = new Date(frontMatter.date)
    
    // 格式化日期（显示用）
    dayjs.extend(relativeTime)
    dayjs.locale('zh-cn')
    const formattedDate = dayjs(originalDate).fromNow()

    // 修改时间
    const stat = await fs.stat(contentPath)
    const modifyTime = stat.mtime.toLocaleString('zh-CN')
    
    // 2. 渲染Markdown内容
    const article = await marked.parse(markdownContent)

    // 3. 渲染文章内容模板
    const postHtml = await ejs.renderFile(
      PATHS.templates.post,
      {
        title: frontMatter.title,
        date: formattedDate,
        modifyDate: modifyTime,
        content: article
      }
    )
    
    // 4. 渲染基础模板
    const baseHtml = await ejs.renderFile(
      PATHS.templates.base,
      { 
        homeUrl: '../index1.html'||'#',
        currentPage: 'post',
        css: '../style.css',
        js: '../script.js',
        body: postHtml,
        blogCount:blogCount,
        userImg: '../user.jpg'
      }
    )
    
    // 5. 确保输出目录存在
    await fs.ensureDir(path.dirname(outputPath))
    
    // 6. 写入文件
    await fs.outputFile(outputPath, baseHtml)
    console.log(`✅ 第${fileKey}个md文件生成成功: ${outputPath}`)
    
    // 返回用于首页的数据
    return {
      title: frontMatter.title,
      originalDate: originalDate, // 保留原始日期用于排序
      formattedDate: formattedDate,
      modifyTime: modifyTime,
      description: frontMatter.description,
      link: path.relative(PATHS.outputDir, outputPath)
    }
  } catch (error) {
    console.error(`❌ 第 ${fileKey} 个md文件处理失败:`, error.message)
    throw error
  }
}

// 分页逻辑
async function paginate(divFragments, pageSize, currentPage) {
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, divFragments.length)
  return divFragments.slice(startIndex, endIndex)
}

// 获取首页所需数据
async function gainAllPosts(postsData) {
  try {
    // 对文章按原始日期排序（最新的在前）
    const sortedPosts = postsData.sort((a, b) => b.originalDate - a.originalDate)
    
    // 生成所有文章的div片段
    const divFragments = []
    for (const post of sortedPosts) {
      const divHtml = await ejs.renderFile(
        PATHS.templates.div,
        {
          title: post.title,
          date: post.formattedDate, // 使用格式化后的日期显示
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

// 生成首页分页
async function generateIndexPage(divs, currentPage, totalPage,blogCount) {
  try {  
    const index = await ejs.renderFile(
      PATHS.templates.index,
      { 
        div: divs.join('\n'),
        totalPage: totalPage,
        currentPage: currentPage
      }
    )
    
    const indexHtml = await ejs.renderFile(
      PATHS.templates.base,
      {
        homeUrl: '#',
        currentPage: 'home',
        css: './style.css',
        js: './script.js',
        body: index,
        blogCount:blogCount,
        userImg: './user.jpg'
      }
    )
    
    // 写入首页文件
    const indexOutputPath = path.join(PATHS.outputDir, `index${currentPage}.html`)
    await fs.outputFile(indexOutputPath, indexHtml)
    console.log(`✅ 首页第${currentPage}页生成成功: ${indexOutputPath}`)
  } catch (error) {
    console.error('❌ 首页生成失败:', error.message)
    throw error
  }
}

// 主处理函数
async function generateSite() {
  try {
    // 0. 复制静态文件
    await copyStaticFiles()

    console.log('🔍 开始扫描MD文件...')
    
    // 1. 获取所有路径
    const { inputPaths, outputPaths } = await getInputAndOutputPaths()
    
    if (inputPaths.length === 0) {
      console.log('⚠️  没有找到任何MD文件，请检查content目录')
      return
    }
    
    console.log('🚀 MD文件扫描完成，开始生成站点...')
    
    // 2. 并发处理所有文件
    const processingTasks = []
    for (let i = 0; i < inputPaths.length; i++) {
      const processingTask = processFile(i + 1, inputPaths[i], outputPaths[i],inputPaths.length)
      processingTasks.push(processingTask)
    }
    
    // 使用 Promise.all 并发执行所有任务
    const postsData = await Promise.all(processingTasks)
    
    // 3. 得到首页数据
    const divFragments = await gainAllPosts(postsData)

    // 4. 生成首页
    const pageSize = 4
    const totalPages = Math.ceil(divFragments.length / pageSize)
    
    const tasks=[]
    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
    const divs= await paginate(divFragments, pageSize, currentPage)
    const task= await generateIndexPage(divs, currentPage, totalPages,inputPaths.length)
    tasks.push(task)
    }
    await Promise.all(tasks)

    console.log('🎉 所有文件生成完成！')
  } catch (error) {
    console.error('💥 站点生成过程中发生错误:', error.message)
    process.exit(1)
  }
}

// 执行生成过程
generateSite()
