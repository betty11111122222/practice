const fs=require('fs-extra')
const path=require('path')
const results=[]
let outputPaths=[]
// 扫描md文件路径
async function collectMdFiles(filePath) {
  try{
    const items = await fs.readdir(filePath, { withFileTypes: true })
    const promises = []
    for (const item of items) {
    const fullPath = path.join(filePath, item.name)
    if (item.isDirectory()) {
      promises.push(collectMdFiles(fullPath))
    } else if (item.isFile() && path.extname(item.name).toLowerCase() === '.md') {
      results.push(fullPath)
    }
  }

  await Promise.all(promises);
  }catch(err){
    console.error('在收集md文件时出错'+err.message)
    throw err
  }
}

//得到输入目录和输出目录
async function getInputAndOutputDir() {
  try{
    await collectMdFiles('./content')
    outputPaths=await Promise.all(
      results.map(async (mdFile) =>{
      const relativePath=path.relative('./content',mdFile)
      const outputDir=path.join('./dist',relativePath.replace(/\.md$/,'.html'))
      return outputDir
    })
    )
  }catch(err){
    console.error('在获取输入目录和输出目录时出错'+err.message)
    throw err
  }
}

async function getPaths(){
  const paths=await getInputAndOutputDir()
  console.log(results,outputPaths)
}

getPaths()


