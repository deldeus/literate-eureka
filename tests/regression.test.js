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
  const context = { window: { SHUNXIN_RATE_DATA: rateData } };
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
  tiers: [
    { min: 100, max: 500, label: "100-500KG" },
    { min: 501, max: 999, label: "501-999KG" },
    { min: 1000, max: 1500, label: "1000-1500KG" }
  ],
  specialAreas: ["测试特别区"],
  rows: [
    { region: "测试省甲市", aliases: ["测试省甲市", "甲市"], rates: [1.4, 1.3, 1.2], eta: "2-3天", note: "" },
    { region: "测试省乙市", aliases: ["测试省乙市", "乙市"], rates: [3, 2.8, 2.6], eta: "3-4天", note: "" }
  ]
};

function quoteInput(address, totalWeight) {
  return {
    address,
    totalWeight,
    pkg: { size: "2.46*1.25*0.25" },
    weightLine: `${totalWeight}KG`,
    packageLine: "2米拖盘：2.46*1.25*0.25",
    dbLine: "DB3",
    db: 3
  };
}

test("顺心捷达重量超过报价上限时停止自动报价", () => {
  const core = loadCore(sampleRates);
  const result = core.buildShunxinQuote(quoteInput("测试省甲市", 2001));
  assert.equal(result.totalText, "人工询价");
  assert.match(result.quoteText, /超出顺心捷达自动报价限制/);
});

test("顺心捷达按实际重量和体积重量取大值并加入DB", () => {
  const core = loadCore(sampleRates);
  const result = core.buildShunxinQuote(quoteInput("测试省甲市", 325));
  assert.equal(result.totalText, "463元");
  assert.match(result.processText, /计费重量：MAX\(325, 153\.8\)=325KG/);
  assert.match(result.quoteText, /顺心捷达预估：463元/);
});

test("顺心捷达保费按货值千分之三计算且最低5元", () => {
  const core = loadCore(sampleRates);
  assert.equal(core.shunxinInsuranceFee(), 5);
  assert.equal(core.shunxinInsuranceFee(2000), 5);
  assert.equal(core.shunxinInsuranceFee(10000), 30);
  const result = core.buildShunxinQuote({ ...quoteInput("测试省甲市", 325), declaredValue: 10000 });
  assert.equal(result.insuranceFee, 30);
  assert.equal(result.totalText, "488元");
  assert.match(result.processText, /保费：30元（10000\*0\.003）/);
});

test("顺心捷达始终计算上门费，仅勾选后并入合计", () => {
  const core = loadCore(sampleRates);
  assert.equal(core.shunxinUpstairsFee(40), 0);
  assert.equal(core.shunxinUpstairsFee(325), 57.5);
  const defaultResult = core.buildShunxinQuote(quoteInput("测试省甲市", 325));
  assert.equal(defaultResult.upstairsFee, 57.5);
  assert.equal(defaultResult.totalText, "463元");
  assert.match(defaultResult.processText, /上门费：57\.5元（未勾选，不计入合计）/);
  const includedResult = core.buildShunxinQuote({ ...quoteInput("测试省甲市", 325), includeUpstairsFee: true });
  assert.equal(includedResult.totalText, "520.5元");
  assert.match(includedResult.processText, /上门费：57\.5元（已计入合计）/);
});

test("顺心捷达特殊地区转人工询价", () => {
  const core = loadCore(sampleRates);
  const result = core.buildShunxinQuote(quoteInput("测试特别区某路", 325));
  assert.equal(result.totalText, "人工询价");
  assert.match(result.processText, /单独询价/);
});

test("鎏金运费页面只使用公共顺心捷达核心", () => {
  const html = read("tools/freight-gold.html");
  assert.doesNotMatch(html, /function matchShunxinRate\(/);
  assert.match(html, /freightCore\.buildShunxinQuote/);
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

test("浙江仓 DB 按小中大板规格分别计价并封顶", () => {
  const core = loadCore(sampleRates);
  assert.equal(core.calculateDb([{ material: "hard", specKey: "hard-600", quantity: 12 }]), 6);
  assert.equal(core.calculateDb([{ spec: { label: "600*2440mm" }, quantity: 12 }]), 9);
  assert.equal(core.calculateDb([{ material: "hard", specKey: "hard-2440", quantity: 12 }]), 18);
  assert.equal(core.calculateDb([
    { material: "hard", specKey: "hard-600", quantity: 12 },
    { spec: { label: "600*2440mm" }, quantity: 4 },
    { material: "hard", specKey: "hard-2440", quantity: 2 }
  ]), 12);
  assert.equal(core.calculateDb([{ material: "hard", specKey: "hard-2440", quantity: 31 }]), 47);
  const roundedShipment = core.calculateShipment([
    { material: "hard", specKey: "hard-2440", quantity: 31 }
  ]);
  assert.equal(roundedShipment.db, 47);
  assert.equal(roundedShipment.dbLine, "DB47");
  assert.equal(core.calculateDb([{ material: "hard", specKey: "hard-2440", quantity: 100 }]), 100);
});

test("浙江仓开单、鎏金运费和文字报价共用 DB 核心", () => {
  const order = read("tools/order-template.html");
  assert.match(order, /GoldFreightCore\.calculateDb\(products\)/);
  assert.doesNotMatch(order, /totalQty \* 1\.5/);
  for (const file of ["tools/order-template.html", "tools/freight-gold.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="freight-gold-core\.js\?v=20260810-2"><\/script>/, file);
  }
});

test("浙江仓物流包含顺心捷达和跨越且不影响其它仓库", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /"浙江仓": \["默认", "姜冉", "西武", "安能", "顺心捷达", "跨越", "货拉拉", "自提"\]/);
  assert.match(html, /"宁波仓": \["默认", "安能", "明邦", "货拉拉", "自提"\]/);
  assert.doesNotMatch(html, /"(?:松诺|168|苏州仓|华中仓|淮海仓|昌盛仓|自选仓)": \[[^\]]*(?:安能|顺心捷达)/);
  assert.match(html, /function renderLogistics\(\)[\s\S]{0,500}index === 0 \? "checked" : ""/);
});

test("浙江仓只有跨越把DB写进开单并扣除KD", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /function separatesDbLine\(warehouse, logistics\) \{\s*return warehouse === "浙江仓" && logistics !== "跨越";\s*\}/);
  assert.match(html, /const dbDeduction = warehouse === "浙江仓" && !dbAsSeparateLine \? built\.db : 0;/);
  assert.match(html, /const dbLine = dbAsSeparateLine && built\.db > 0 \? `DB\$\{money\(built\.db\)\}` : "";/);
});

test("顺心捷达三个入口均接入保费和上门费", () => {
  const freight = read("tools/freight-gold.html");
  const order = read("tools/order-template.html");
  const quote = read("tools/quote-generator.html");
  assert.match(freight, /id="shunxinDeclaredValue"/);
  assert.match(freight, /declaredValue: els\.shunxinDeclaredValue\.value/);
  assert.match(freight, /includeUpstairsFee: els\.shunxinIncludeUpstairs\.checked/);
  assert.match(order, /declaredValue: total/);
  assert.match(order, /includeUpstairsFee: els\.orderShunxinIncludeUpstairs\.checked/);
  assert.match(order, /const show = warehouse === "浙江仓" && isLiujin;/);
  assert.match(quote, /declaredValue: currentQuoteTotal/);
  assert.match(quote, /includeUpstairsFee: els\.quoteShunxinIncludeUpstairs\.checked/);
});

test("文字报价和开单模板始终保留顺心捷达报价窗口", () => {
  const order = read("tools/order-template.html");
  const quote = read("tools/quote-generator.html");
  assert.match(quote, /<section class="shunxin-section" id="quoteShunxinSection"/);
  assert.doesNotMatch(quote, /quoteShunxinSection\.classList\.(?:add|remove)\("hidden"\)/);
  assert.match(order, /const show = warehouse === "浙江仓" && isLiujin;/);
  assert.doesNotMatch(order, /isLiujin && logistics === "顺心捷达"/);
});

test("顺心捷达三个入口的费用控件使用统一对齐栅格", () => {
  ["tools/freight-gold.html", "tools/order-template.html", "tools/quote-generator.html"].forEach((file) => {
    const html = read(file);
    assert.match(html, /\.shunxin-options\s*\{[\s\S]{0,260}display:\s*grid;/);
    assert.match(html, /class="shunxin-option-cell"/);
    assert.match(html, />上门服务</);
    assert.match(html, />保价费用</);
    assert.match(html, />上门费用</);
  });
});

test("开单模板付款方式包含T农行并可写入付款结果", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /name="paymentMethod" value="T农行"><span>T农行<\/span>/);
  assert.match(html, /const method = selectedPaymentMethod\(\);[\s\S]{0,180}els\.payment\.value = method && channel \? `\$\{method\}-\$\{channel\}` : \(method \|\| channel\);/);
  assert.match(html, /付款方式：\$\{els\.payment\.value\.trim\(\) \|\| "未填写"\}/);
});

test("浙江仓自提和货拉拉仅隐藏开单正文中的重量包装与 DB", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /function hidesZhejiangOrderShippingSummary\(warehouse, logistics\) \{\s*return warehouse === "浙江仓" && \(logistics === "货拉拉" \|\| logistics === "自提"\);\s*\}/);
  assert.match(html, /const hideOrderShippingSummary = hidesZhejiangOrderShippingSummary\(warehouse, logistics\);/);
  assert.match(html, /const dbPart = warehouse === "浙江仓" && !dbAsSeparateLine && !hideOrderShippingSummary/);
  assert.match(html, /const orderWeightPart = hideOrderShippingSummary \? "" : weightPart;/);
  assert.match(html, /if \(orderWeightPart\) lines\.push\(orderWeightPart\);/);
  assert.match(html, /els\.weightPreview\.textContent = weightPart \|\| "-";/);
  assert.match(html, /els\.freightQuestion\.textContent = isNingboWarehouseActive\(\) \? ningboFreightQuestion : zhejiangFreightQuestion;/);
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
  assert.match(html, /<script src="product-data\.js\?v=20260804-1"><\/script>/);
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

test("快速查价为全部鎏金系列显示最低售价且不修改共享底价", () => {
  const html = read("tools/quick-price.html");
  const productData = loadProductData();
  assert.match(html, /const liujinMinimumPriceGroups = \[/);
  assert.match(html, /'hard-2440':85, 'hard-3050':85, 'soft-2440':95, 'soft-3000':95/);
  assert.match(html, /'hard-2440':115, 'hard-3050':115, 'soft-2440':125, 'soft-3000':125/);
  assert.match(html, /'hard-2440':125, 'hard-3050':125, 'soft-2440':140, 'soft-3000':140/);
  assert.match(html, /'hard-2440':220, 'hard-3050':220, 'soft-2440':235, 'soft-3000':235/);
  assert.match(html, /\{ 'hard-2440':140 \}/);
  assert.match(html, /<small>最低售价<\/small>/);
  assert.equal(productData.findLiujinSeriesPrice("大漠沙丘", "hard-3050"), 70);
  assert.equal(productData.findLiujinSeriesPrice("珠光", "soft-3000"), 165);
});

test("混凝土168附加费使用最新计价规则", () => {
  const html = read("tools/order-template.html");
  const productData = loadProductData();
  assert.match(html, /return currentWarehouse\(\) === "168" \? 5 : 10/);
  assert.match(html, /倒边平方数/);
  assert.match(html, /干挂孔 1元\/个/);
  assert.match(html, /干挂件 8元\/个/);
  assert.match(html, /30种规格以上 \+10元\/㎡/);
  assert.match(html, /productData\.concrete168PackagingFee\(products, area\)/);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168清水板", specText: "1200*600mm" }], 4.9), 100);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168清水板", specText: "1200*2400mm" }], 4.9), 150);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168清水板", specText: "1500*1000mm" }], 4.9), 150);
  assert.equal(productData.concrete168PackagingFee([{ productName: "平板", productType: "flat", specText: "1200*600mm" }], 4.9), 100);
  assert.equal(productData.concrete168PackagingFee([{ productName: "虫洞", productType: "cave", specText: "1200*2400mm" }], 4.9), 150);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168清水板", specText: "1200*600mm" }], 5), 0);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168透光板", specText: "1200*600mm" }], 4.9), 100);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168透光板", specText: "1200*2400mm" }], 4.9), 150);
  assert.equal(productData.concrete168PackagingFee([
    { productName: "168清水板", specText: "1200*600mm" },
    { productName: "168清水板", specText: "1200*2400mm" }
  ], 4.9), 150);
  assert.doesNotMatch(html, /倒边米数/);
});

test("快速查价同步松诺与168附加费用说明", () => {
  const html = read("tools/quick-price.html");
  const productData = loadProductData();
  assert.match(html, /打孔\+7元\/㎡；倒边\+10元\/㎡；超过20种规格另加10元\/㎡/);
  assert.match(html, /打孔\+5元\/㎡；倒边\+5元\/㎡；干挂孔1元\/个；干挂件8元\/个/);
  assert.match(html, /productData\.concrete168PackagingNote/);
  assert.match(productData.concrete168PackagingNote, /小板（1200\*600mm）包装费100元/);
  assert.match(productData.concrete168PackagingNote, /大板（1200\*2400mm或单件面积1\.5㎡以上）包装费150元/);
  assert.doesNotMatch(html, /倒边：\+5元\/米/);
});

test("三个业务页面共同读取产品数据", () => {
  for (const file of ["tools/order-template.html", "tools/quick-price.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="product-data\.js\?v=20260804-1"><\/script>/, file);
  }
});

test("公共业务逻辑带版本标记避免浏览器继续使用旧缓存", () => {
  for (const file of ["tools/order-template.html", "tools/freight-gold.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="freight-gold-core\.js\?v=20260810-2"><\/script>/, file);
  }
  for (const file of ["tools/order-template.html", "tools/freight-gold.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="shunxin-rates\.js\?v=20260808-1"><\/script>/, file);
  }
});

test("三处鎏金板业务共同使用顺心捷达且跨越只作为开单物流", () => {
  for (const file of ["tools/freight-gold.html", "tools/order-template.html", "tools/quote-generator.html"]) {
    const html = read(file);
    assert.match(html, /buildShunxinQuote/, file);
    assert.doesNotMatch(html, /KYE|kye-rates|buildKyeQuote/, file);
  }
  assert.doesNotMatch(read("tools/freight-gold.html"), /跨越/);
  assert.doesNotMatch(read("tools/quote-generator.html"), /跨越/);
  assert.match(read("tools/order-template.html"), /"跨越"/);
});

test("整板切割与上墙排版使用统一标题和控件高度", () => {
  const fullBoard = read("tools/full-board-cut.html");
  const wallPanel = read("tools/wall-panel.html");
  assert.match(fullBoard, /\.header h1[\s\S]{0,300}font-size:/);
  assert.match(wallPanel, /\.app > aside > h1[\s\S]{0,300}font-size:/);
  assert.match(fullBoard, /--tool-control-height:\s*44px/);
  assert.match(wallPanel, /--tool-control-height:\s*44px/);
});

test("上墙排版板材参数左侧为板宽右侧为板高", () => {
  const html = read("tools/wall-panel.html");
  assert.match(html, /<label for="boardW">板宽 mm<\/label>\s*<input id="boardW"/);
  assert.match(html, /<label for="boardH">板高 mm<\/label>\s*<input id="boardH"/);
  assert.doesNotMatch(html, /<label[^>]*>板长 mm<\/label>/);
  assert.match(html, /const baseW = value\("boardW"\);\s*const baseH = value\("boardH"\);/);
});

test("上墙排版支持板间留缝且墙体四周不扣缝", () => {
  const html = read("tools/wall-panel.html");
  ["0", "1", "2", "3", "4", "5", "10", "custom"].forEach((value) => {
    assert.match(html, new RegExp(`<option value="${value}">`));
  });
  assert.match(html, /id="jointGapCustom"[^>]+min="0"[^>]+step="0\.1"/);
  assert.match(html, /只计算板材与板材之间的伸缩缝，墙体四周一圈不预留缝隙/);
  assert.match(html, /const panelSpace = safeTotal - safeGap \* \(count - 1\);/);
  assert.match(html, /if \(col < cols\.length - 1\) x \+= jointGap;/);
  assert.match(html, /if \(row < rows\.length - 1\) y \+= jointGap;/);
  assert.match(html, /留缝 \$\{fmt\(data\.jointGap\)\}（仅板间）/);
});

test("主页版本号和所有工具入口完整", () => {
  const index = read("index.html");
  assert.match(index, /v2026\.08\.14\.1/);
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
