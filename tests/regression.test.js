const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadCore(rateData) {
  const context = { window: { KYE_RATE_DATA: rateData } };
  vm.createContext(context);
  vm.runInContext(read("tools/freight-gold-core.js"), context);
  return context.window.GoldFreightCore;
}

const sampleRates = {
  outside: [
    {
      province: "测试省",
      cities: ["甲市"],
      firstWeight: 1,
      firstPrice: 10,
      intervals: [[1, 100, 2], [100, 2000, 1.4]]
    },
    {
      province: "测试省",
      cities: ["乙市"],
      firstWeight: 1,
      firstPrice: 10,
      intervals: [[1, 2000, 3]]
    }
  ],
  anhui: []
};

function quoteInput(address, totalWeight) {
  return {
    address,
    totalWeight,
    pkg: { size: "2.46*1.25*0.25" },
    weightLine: `${totalWeight}KG`,
    packageLine: "2米拖盘：2.46*1.25*0.25",
    dbLine: "DB3"
  };
}

test("跨越重量超过线路上限时停止自动报价", () => {
  const core = loadCore(sampleRates);
  const result = core.buildKyeQuote(quoteInput("测试省甲市", 2001));
  assert.equal(result.totalText, "-");
  assert.match(result.processText, /没有匹配到跨越重量段/);
});

test("只识别到存在多个费率的省份时要求补充城市", () => {
  const core = loadCore(sampleRates);
  const result = core.buildKyeQuote(quoteInput("测试省某区", 325));
  assert.equal(result.totalText, "-");
  assert.match(result.processText, /城市/);
});

test("鎏金运费页面只使用公共跨越核心", () => {
  const html = read("tools/freight-gold.html");
  assert.doesNotMatch(html, /function matchKyeRate\(/);
  assert.doesNotMatch(html, /function kyeInterval\(/);
  assert.match(html, /freightCore\.buildKyeQuote/);
});

test("文字报价不把空产品识别成鎏金板", () => {
  const html = read("tools/quote-generator.html");
  assert.match(html, /if \(!productText\.trim\(\)\) return false;/);
});

test("空白开单不显示包装超量警告", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /built\.qty > 0 && \(isLiujin \|\| isSandstone\) && !built\.packageOk/);
});

test("宁波仓显示宁波专用规则提示", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /isNingboWarehouseActive\(\)[\s\S]{0,300}宁波仓/);
});

test("快速查价同名产品同时保留宁波和 MLL 结果", () => {
  const html = read("tools/quick-price.html");
  assert.match(html, /sameNameNingboAndMeililai/);
});

test("三个业务页面共同读取产品数据", () => {
  for (const file of ["tools/order-template.html", "tools/quick-price.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="product-data\.js"><\/script>/, file);
  }
});

test("主页版本号和所有工具入口完整", () => {
  const index = read("index.html");
  assert.match(index, /v2026\.07\.10/);
  const routeMatch = index.match(/const toolPaths = (\{[^;]+\});/);
  assert.ok(routeMatch, "未找到工具入口表");
  const routes = JSON.parse(routeMatch[1]);
  Object.values(routes).forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(root, relativePath)), `缺少工具文件：${relativePath}`);
  });
});

test("所有外部脚本引用都存在", () => {
  const htmlFiles = ["index.html", ...fs.readdirSync(path.join(root, "tools")).filter((file) => file.endsWith(".html")).map((file) => `tools/${file}`)];
  htmlFiles.forEach((htmlFile) => {
    const html = read(htmlFile);
    for (const match of html.matchAll(/<script src="([^"]+)"><\/script>/g)) {
      const target = path.resolve(path.dirname(path.join(root, htmlFile)), match[1]);
      assert.ok(fs.existsSync(target), `${htmlFile} 引用了不存在的脚本：${match[1]}`);
    }
  });
});
