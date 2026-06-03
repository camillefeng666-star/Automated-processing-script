# 自动翻页脚本 - 安装使用指南

## 方案：Tampermonkey油猴脚本（推荐）

### 安装步骤

#### 1. 安装Tampermonkey扩展
- **Chrome/Edge**: 访问 [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: 访问 [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- 点击"添加至Chrome/Edge/Firefox"

#### 2. 安装自动翻页脚本
1. 打开Tampermonkey菜单（浏览器右上角图标）
2. 选择"添加新脚本"
3. 删除编辑器中的所有内容
4. 复制 `auto_next_page.user.js` 文件的全部内容
5. 粘贴到编辑器中
6. 按 `Ctrl+S` 保存（或点击文件→保存）

#### 3. 使用脚本
1. **先手动登录**你的账号（这是关键！）
2. 登录成功后，进入需要翻页的页面
3. 页面右上角会出现绿色控制面板：
   - 设置翻页间隔（建议3-5秒）
   - 设置最大页数（0表示无限翻页）
   - 点击"▶ 开始"启动自动翻页
   - 点击"⏹ 停止"随时停止

### 功能特点

✅ **智能识别下一页按钮**
- 自动识别中文"下一页"、英文"Next"
- 支持常见的分页class（.next, .pagination-next等）
- 支持箭头图标（›, →, »）

✅ **可视化控制面板**
- 实时显示当前页码和已翻页数
- 可调节翻页间隔时间
- 可设置最大翻页次数
- 一键开始/停止

✅ **安全可靠**
- 只在当前页面运行，不影响其他网站
- 可随时手动停止
- 到达最后一页自动停止

### 常见问题

**Q: 脚本没有显示控制面板？**
A: 刷新页面，或检查Tampermonkey是否已启用

**Q: 找不到下一页按钮？**
A: 不同网站的按钮文字可能不同，可以修改脚本中的 `textPatterns` 数组添加自定义文字

**Q: 翻页太快被限制？**
A: 增加间隔时间到5-10秒，模拟人工操作

**Q: 如何只在特定网站使用？**
A: 修改脚本头部的 `@match` 规则，例如：
```
// @match    https://target-site.com/*
```

### 自定义配置

编辑脚本中的 `CONFIG` 对象：

```javascript
const CONFIG = {
    delay: 3000,           // 翻页间隔（毫秒）
    maxPages: 0,           // 最大页数（0=无限）
    enabled: true,         // 默认启用

    // 添加自定义下一页按钮文字
    nextButtonSelectors: [
        'a:contains("下一页")',
        'a:contains("加载更多")',  // 添加你的自定义文字
        // ...
    ]
};
```
