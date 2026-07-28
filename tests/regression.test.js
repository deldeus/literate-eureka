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

function loadNingboCore() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read("tools/ningbo-freight-core.js"), context);
  return context.window.NingboFreightCore;
}

function loadProductData() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read("tools/product-data.js"), context);
  return context.window.JieGeProductData;
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

test("鎏金运费不支持的规格不会回退成默认规格", () => {
  const core = loadCore(sampleRates);
  assert.equal(core.matchSpecKey("hard", "硬质-1220*2800*6mm"), null);
  const result = core.calculateShipment([
    { material: "hard", specKey: null, quantity: 2 }
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.type, "unsupported-spec");
});

test("鎏金运费页面只保留公共包装核算逻辑", () => {
  const html = read("tools/freight-gold.html");
  assert.match(html, /freightCore\.calculateShipment/);
  assert.doesNotMatch(html, /function choosePackage\(/);
  assert.doesNotMatch(html, /function shipmentLengthType\(/);
});

test("文字报价不把空产品识别成鎏金板", () => {
  const html = read("tools/quote-generator.html");
  assert.match(html, /if \(!productText\.trim\(\)\) return false;/);
});

test("文字报价只在复制完整报价后写入历史记录", () => {
  const html = read("tools/quote-generator.html");
  const renderFunction = html.match(/function render\(\) \{[\s\S]*?\n    \}/)?.[0] || "";
  assert.doesNotMatch(renderFunction, /saveHistorySnapshot|autoSaveHistory/);
  assert.match(html, /function saveHistorySnapshot\(\)/);
  assert.match(html, /els\.copyBtn\.addEventListener\("click", async \(\) => \{[\s\S]{0,500}saveHistorySnapshot\(\)/);
});

test("空白开单不显示包装超量警告", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /built\.qty > 0 && \(isLiujin \|\| isSandstone\) && !built\.packageOk/);
});

test("宁波仓显示宁波专用规则提示", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /isNingboWarehouseActive\(\)[\s\S]{0,300}宁波仓/);
});

test("宁波多产品合装取最长和最宽并累计厚度", () => {
  const core = loadNingboCore();
  const result = core.calculateShipment([
    { name: "星月石", spec: "1160*3100", qty: 1, thickness: 8, kgPerSqm: 10 },
    { name: "斧开石", spec: "1200*3000", qty: 1, thickness: 12, kgPerSqm: 12 }
  ]);
  assert.equal(result.crateLength, 3200);
  assert.equal(result.crateWidth, 1300);
  assert.equal(result.crateHeight, 220);
  assert.equal(result.packageWeight, 65);
  assert.equal(result.crateLines.length, 1);
  assert.equal(result.crateLines[0], "木箱：1300*3200*220mm");
});

test("宁波多产品合装只计一个包装重量", () => {
  const core = loadNingboCore();
  const result = core.calculateShipment([
    { name: "星月石", spec: "3100*1160", qty: 1, thickness: 8, kgPerSqm: 10 },
    { name: "斧开石", spec: "3000*1200", qty: 1, thickness: 12, kgPerSqm: 12 }
  ]);
  assert.match(result.expression, /\+65=/);
  assert.doesNotMatch(result.expression, /\+65\+65=/);
});

test("宁波 1200*600 规格带厚度时仍按小板包装", () => {
  const core = loadNingboCore();
  const plain = core.calculateShipment([
    { name: "3D洞石", spec: "1200*600", qty: 5, thickness: 6, kgPerSqm: 10 }
  ]);
  const withThickness = core.calculateShipment([
    { name: "3D洞石", spec: "1200*600*6mm", qty: 5, thickness: 6, kgPerSqm: 10 }
  ]);
  assert.equal(withThickness.packageWeight, plain.packageWeight);
  assert.equal(withThickness.packageType, plain.packageType);
  assert.equal(withThickness.crateLength, plain.crateLength);
  assert.equal(withThickness.crateWidth, plain.crateWidth);
});

test("宁波重量和开单模板共同读取宁波运费核心", () => {
  for (const file of ["tools/ningbo-weight.html", "tools/order-template.html"]) {
    const html = read(file);
    assert.match(html, /<script src="ningbo-freight-core\.js\?v=20260713-2"><\/script>/, file);
    assert.match(html, /NingboFreightCore\.calculateShipment/, file);
  }
});

test("宁波重量提供多产品明细操作", () => {
  const html = read("tools/ningbo-weight.html");
  assert.match(html, /id="addShipmentItem"/);
  assert.match(html, /id="shipmentItems"/);
});

test("宁波重量同步开单模板的星云石产品", () => {
  const html = read("tools/ningbo-weight.html");
  assert.match(html, /<script src="product-data\.js\?v=20260720-1"><\/script>/);
  assert.match(html, /"星云石": "星月石"/);
  assert.match(html, /"星云石B款": "星月石"/);
  assert.match(html, /JieGeProductData\?\.groupedNingboCatalog/);
});

test("宁波新增产品复用已确认重量并同步最新规格", () => {
  const html = read("tools/ningbo-weight.html");
  assert.match(html, /"波浪": "波浪石"/);
  assert.match(html, /"50马赛克小板1": "50马赛克"/);
  assert.match(html, /"22马赛克小板2": "22马赛克"/);
  assert.match(html, /"3D洞石": \{ default: "洞石", sizeSources: \{ "1200\*600": "小洞石" \} \}/);
  assert.match(html, /"3D新版洞石": "新款洞石"/);
  assert.match(html, /"粗夯土3D": "夯土B（粗夯土）"/);

  const productData = loadProductData();
  const grouped = productData.groupedNingboCatalog();
  assert.deepEqual(Array.from(grouped.find((item) => item.name === "50马赛克小板1").specs), ["1190*590"]);
  assert.deepEqual(Array.from(grouped.find((item) => item.name === "22马赛克小板2").specs), ["1190*590"]);
  assert.deepEqual(Array.from(grouped.find((item) => item.name === "粗夯土3D").specs), ["3000*1200", "2900*1160", "2800*1030", "2680*930"]);
});

test("开单模板使用新版洞石、波浪石和粗夯土的独立重量", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /keys: \["3d新版洞石", "新版洞石"\], kgPerSqm: 7, thickness: 4\.5/);
  assert.match(html, /keys: \["波浪石", "波浪"\], kgPerSqm: 7, thickness: 6/);
  assert.match(html, /keys: \["粗夯土3d"\], kgPerSqm: 6\.5, thickness: 4/);
});

test("快速查价同名产品同时保留宁波和 MLL 结果", () => {
  const html = read("tools/quick-price.html");
  assert.match(html, /sameNameNingboAndMeililai/);
});

test("大漠沙丘名称中的珠光白按大漠系列计价", () => {
  const productData = loadProductData();
  assert.equal(productData.findLiujinSeriesPrice("大漠沙丘DM220珠光白", "hard-3050"), 70);
  assert.equal(productData.findLiujinSeriesPrice("大漠沙丘DM220珠光白", "soft-3000"), 80);
  assert.equal(productData.findLiujinSeriesPrice("珠光白", "hard-3050"), 155);
});

test("混凝土168附加费使用最新计价规则", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /return currentWarehouse\(\) === "168" \? 5 : 10/);
  assert.match(html, /倒边平方数/);
  assert.match(html, /干挂孔 1元\/个/);
  assert.match(html, /干挂件 8元\/个/);
  assert.match(html, /30种规格以上 \+10元\/㎡/);
  assert.match(html, /area < 5/);
  assert.match(html, /\/清水\|透光\/\.test\(item\.productName\)/);
  assert.match(html, /name: "不足5平方包装费", amount: 200/);
  assert.doesNotMatch(html, /倒边米数/);
});

test("快速查价同步松诺与168附加费用说明", () => {
  const html = read("tools/quick-price.html");
  assert.match(html, /打孔\+7元\/㎡；倒边\+10元\/㎡；超过20种规格另加10元\/㎡/);
  assert.match(html, /打孔\+5元\/㎡；倒边\+5元\/㎡；干挂孔1元\/个；干挂件8元\/个/);
  assert.match(html, /清水板、透光板订单不足5㎡，包装费\+200元/);
  assert.doesNotMatch(html, /倒边：\+5元\/米/);
});

test("三个业务页面共同读取产品数据", () => {
  for (const file of ["tools/order-template.html", "tools/quick-price.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="product-data\.js\?v=20260720-1"><\/script>/, file);
  }
});

test("公共业务逻辑带版本标记避免浏览器继续使用旧缓存", () => {
  for (const file of ["tools/freight-gold.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="freight-gold-core\.js\?v=20260713-2"><\/script>/, file);
  }
  for (const file of ["tools/freight-gold.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="kye-rates\.js\?v=20260713-2"><\/script>/, file);
  }
});

test("整板切割与上墙排版使用统一标题和控件高度", () => {
  const fullBoard = read("tools/full-board-cut.html");
  const wallPanel = read("tools/wall-panel.html");
  assert.match(fullBoard, /\.header h1[\s\S]{0,300}font-size:/);
  assert.match(wallPanel, /\.app > aside > h1[\s\S]{0,300}font-size:/);
  assert.match(fullBoard, /--tool-control-height:\s*44px/);
  assert.match(wallPanel, /--tool-control-height:\s*44px/);
});

test("主页版本号和所有工具入口完整", () => {
  const index = read("index.html");
  assert.match(index, /v2026\.07\.15/);
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
      const scriptPath = match[1].split("?")[0];
      const target = path.resolve(path.dirname(path.join(root, htmlFile)), scriptPath);
      assert.ok(fs.existsSync(target), `${htmlFile} 引用了不存在的脚本：${match[1]}`);
    }
  });
});
