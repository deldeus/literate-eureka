杰哥工具完整版本：v2026.07.10

上传 GitHub Pages 时，上传本文件夹里的 index.html 和 tools 文件夹。
必须完整覆盖 tools 文件夹，不能只上传单个 HTML。

本次版本已加入公共产品数据和回归检查：
- 产品规格价格统一保存在 tools/product-data.js。
- 鎏金运费与文字报价共同使用 tools/freight-gold-core.js。
- 本地检查命令：node --test tests/regression.test.js
